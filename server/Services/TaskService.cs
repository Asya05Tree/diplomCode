using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// planner-spec.md §2.2, §3.3, §4.2-4.5. Уся логіка задач/календаря: розгортання повторень,
// перехід протермінованих задач у Unknown, накладання, вільні дні.
// Дати трактуються як "голий" wall-clock без часових поясів — у проєкті немає поля таймзони
// ні на користувачі, ні деінде, тому й конвертацій ніде немає (свідоме спрощення для дипломного проєкту).
public class TaskService
{
    private readonly AppDbContext _db;

    public TaskService(AppDbContext db)
    {
        _db = db;
    }

    private static DateTime Today => DateTime.Now.Date;

    public record TaskItemDto(
        int Id, string Title, string? Description, DateTime? StartDateTime,
        int? DurationMinutes, DateTime? Deadline, string Status, bool IsPinned,
        bool IsVirtual, int? RecurrenceRuleId, bool Overlaps);

    public record FreeDayDto(DateOnly Date, bool IsFreeEnough);

    public record PreviewEntry(DateOnly Date, string Type); // occurrence | cancelled | moved-away | moved-in

    public record RecurrenceExceptionDto(int Id, DateOnly Date, string ExceptionType, DateTime? NewDateTime);

    public record RecurrenceRuleDto(
        int Id, int TaskId, string Title, string? Description, int? DurationMinutes,
        string Pattern, string? DaysOfWeek, TimeOnly TimeOfDay, DateOnly StartDate, DateOnly? EndDate,
        List<RecurrenceExceptionDto> Exceptions);

    // ---- Розгортання повторень ----------------------------------------------------------

    private static int IsoDayOfWeek(DateOnly d) => d.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)d.DayOfWeek;

    // Базові дати спрацювання правила, без урахування винятків
    private static List<DateOnly> GenerateBaseDates(RecurrenceRule rule, DateOnly from, DateOnly to)
    {
        var rangeStart = rule.StartDate > from ? rule.StartDate : from;
        var rangeEnd = rule.EndDate.HasValue && rule.EndDate.Value < to ? rule.EndDate.Value : to;
        var result = new List<DateOnly>();
        if (rangeStart > rangeEnd) return result;

        switch (rule.Pattern)
        {
            case "Daily":
                for (var d = rangeStart; d <= rangeEnd; d = d.AddDays(1))
                    result.Add(d);
                break;

            case "Weekly":
                var days = (rule.DaysOfWeek ?? "")
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(int.Parse)
                    .ToHashSet();
                for (var d = rangeStart; d <= rangeEnd; d = d.AddDays(1))
                    if (days.Contains(IsoDayOfWeek(d))) result.Add(d);
                break;

            case "Monthly":
                // Той самий день місяця, що й StartDate.Day; місяці, де такого дня немає, пропускаються
                var cursor = new DateOnly(rangeStart.Year, rangeStart.Month, 1);
                var limit = new DateOnly(rangeEnd.Year, rangeEnd.Month, 1);
                while (cursor <= limit)
                {
                    if (rule.StartDate.Day <= DateTime.DaysInMonth(cursor.Year, cursor.Month))
                    {
                        var candidate = new DateOnly(cursor.Year, cursor.Month, rule.StartDate.Day);
                        if (candidate >= rangeStart && candidate <= rangeEnd) result.Add(candidate);
                    }
                    cursor = cursor.AddMonths(1);
                }
                break;
        }

        return result;
    }

    // Для лівої сітки в режимі "Повторювані": усі типи днів одним списком (§4.3)
    public static List<PreviewEntry> PreviewOccurrences(RecurrenceRule rule, DateOnly from, DateOnly to)
    {
        var baseDates = GenerateBaseDates(rule, from, to);
        var exceptionByDate = rule.Exceptions.ToDictionary(e => e.Date, e => e);
        var result = new List<PreviewEntry>();

        foreach (var d in baseDates)
        {
            if (exceptionByDate.TryGetValue(d, out var ex))
                result.Add(new PreviewEntry(d, ex.ExceptionType == "Cancelled" ? "cancelled" : "moved-away"));
            else
                result.Add(new PreviewEntry(d, "occurrence"));
        }

        foreach (var ex in rule.Exceptions.Where(e => e.ExceptionType == "Moved" && e.NewDateTime.HasValue))
        {
            var newDate = DateOnly.FromDateTime(ex.NewDateTime!.Value);
            if (newDate >= from && newDate <= to) result.Add(new PreviewEntry(newDate, "moved-in"));
        }

        return result.OrderBy(r => r.Date).ToList();
    }

    // Фактичні моменти часу, у які правило дає видиму подію (для Дня/Періоду)
    public static List<DateTime> GetEffectiveOccurrences(RecurrenceRule rule, DateOnly from, DateOnly to)
    {
        var baseDates = GenerateBaseDates(rule, from, to);
        var exceptionByDate = rule.Exceptions.ToDictionary(e => e.Date, e => e);
        var result = new List<DateTime>();

        foreach (var d in baseDates)
        {
            if (exceptionByDate.ContainsKey(d)) continue; // Cancelled — пропуск; Moved — додасться нижче
            result.Add(d.ToDateTime(rule.TimeOfDay));
        }

        foreach (var ex in rule.Exceptions.Where(e => e.ExceptionType == "Moved" && e.NewDateTime.HasValue))
        {
            var newDate = DateOnly.FromDateTime(ex.NewDateTime!.Value);
            if (newDate >= from && newDate <= to) result.Add(ex.NewDateTime!.Value);
        }

        return result;
    }

    // ---- День / Період -------------------------------------------------------------------

    public async Task<List<TaskItemDto>> GetTasksForRangeAsync(int userId, DateOnly from, DateOnly to)
    {
        var fromDt = from.ToDateTime(TimeOnly.MinValue);
        var toDt = to.ToDateTime(TimeOnly.MaxValue);

        var oneTime = await _db.Tasks
            .Where(t => t.UserId == userId && t.RecurrenceRuleId == null
                && t.StartDateTime != null && t.StartDateTime >= fromDt && t.StartDateTime <= toDt)
            .ToListAsync();

        var dtos = oneTime.Select(t => new TaskItemDto(
            t.Id, t.Title, t.Description, t.StartDateTime, t.DurationMinutes, t.Deadline,
            t.Status, t.IsPinned, false, null, false)).ToList();

        var rules = await _db.RecurrenceRules.Include(r => r.Exceptions)
            .Where(r => r.UserId == userId).ToListAsync();

        if (rules.Count > 0)
        {
            // Шаблон-задача — сама ніколи не показується, лише постачає Title/Duration/Description
            var templates = await _db.Tasks
                .Where(t => t.UserId == userId && t.RecurrenceRuleId != null)
                .ToListAsync();
            var templateByRuleId = templates.ToDictionary(t => t.RecurrenceRuleId!.Value);

            foreach (var rule in rules)
            {
                if (!templateByRuleId.TryGetValue(rule.Id, out var template)) continue;
                foreach (var dt in GetEffectiveOccurrences(rule, from, to))
                {
                    dtos.Add(new TaskItemDto(
                        template.Id, template.Title, template.Description, dt, template.DurationMinutes,
                        template.Deadline, "Planned", false, true, rule.Id, false));
                }
            }
        }

        // Накладання — дві задачі на точно один час (§4.4): не залежить від DurationMinutes,
        // тому лишається однозначним навіть коли тривалість не заповнена
        var overlapping = dtos.Where(d => d.StartDateTime.HasValue)
            .GroupBy(d => d.StartDateTime!.Value)
            .Where(g => g.Count() > 1)
            .SelectMany(g => g)
            .ToHashSet();

        return dtos
            .Select(d => overlapping.Contains(d) ? d with { Overlaps = true } : d)
            .OrderBy(d => d.StartDateTime)
            .ToList();
    }

    public async Task<List<TaskItemDto>> GetDayTasksAsync(int userId, DateOnly date)
    {
        await SweepStaleTasksAsync(userId);
        return await GetTasksForRangeAsync(userId, date, date);
    }

    public async Task<List<TaskItemDto>> GetPeriodTasksAsync(int userId, DateOnly from, DateOnly to)
    {
        await SweepStaleTasksAsync(userId);
        return await GetTasksForRangeAsync(userId, from, to);
    }

    // ---- Вільні дні (§4.3 "Період") -------------------------------------------------------

    public async Task<List<FreeDayDto>> GetFreeDaysAsync(int userId, DateOnly from, DateOnly to, double minHours)
    {
        var profile = await _db.UserProfiles.FindAsync(userId);
        var dayStartMin = (profile?.DayStart ?? new TimeOnly(8, 0)).ToTimeSpan().TotalMinutes;
        var dayEndMin = (profile?.DayEnd ?? new TimeOnly(22, 0)).ToTimeSpan().TotalMinutes;
        var minMinutes = minHours * 60;

        // Тільки задачі із заданою тривалістю формують зайняті інтервали — без неї немає
        // чесного способу порахувати, коли задача закінчується (§4.4, той самий принцип, що й для overlap)
        var tasks = await GetTasksForRangeAsync(userId, from, to);

        var result = new List<FreeDayDto>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            var busy = tasks
                .Where(t => t.StartDateTime.HasValue && t.DurationMinutes.HasValue
                    && DateOnly.FromDateTime(t.StartDateTime!.Value) == d)
                .Select(t =>
                {
                    var start = Math.Clamp(t.StartDateTime!.Value.TimeOfDay.TotalMinutes, dayStartMin, dayEndMin);
                    var end = Math.Clamp(start + t.DurationMinutes!.Value, dayStartMin, dayEndMin);
                    return (start, end);
                })
                .Where(iv => iv.end > iv.start)
                .OrderBy(iv => iv.start)
                .ToList();

            var merged = new List<(double start, double end)>();
            foreach (var iv in busy)
            {
                if (merged.Count > 0 && iv.start <= merged[^1].end)
                    merged[^1] = (merged[^1].start, Math.Max(merged[^1].end, iv.end));
                else
                    merged.Add(iv);
            }

            var maxGap = 0.0;
            var cursor = dayStartMin;
            foreach (var iv in merged)
            {
                maxGap = Math.Max(maxGap, iv.start - cursor);
                cursor = Math.Max(cursor, iv.end);
            }
            maxGap = Math.Max(maxGap, dayEndMin - cursor);

            result.Add(new FreeDayDto(d, maxGap >= minMinutes));
        }

        return result;
    }

    // ---- Нерозподілені / ранковий нагадувальник (§4.5) -----------------------------------

    // Задача, яку "забули" відмітити — Planned з датою в минулому — стає Unknown.
    // Викликається на початку day/period/unassigned-запитів; /reminder працює з учорашніми
    // Planned-задачами ДО цього виклику, інакше йому нічого буде показати.
    public async Task SweepStaleTasksAsync(int userId)
    {
        var stale = await _db.Tasks
            .Where(t => t.UserId == userId && t.RecurrenceRuleId == null && t.Status == "Planned"
                && t.StartDateTime != null && t.StartDateTime.Value.Date < Today)
            .ToListAsync();
        if (stale.Count == 0) return;
        foreach (var t in stale) t.Status = "Unknown";
        await _db.SaveChangesAsync();
    }

    public async Task<List<TaskItemDto>> GetUnassignedAsync(int userId)
    {
        await SweepStaleTasksAsync(userId);
        var tasks = await _db.Tasks
            .Where(t => t.UserId == userId && t.RecurrenceRuleId == null
                && (t.Status == "Unknown" || t.Status == "Unassigned"))
            .OrderBy(t => t.Deadline == null)
            .ThenBy(t => t.Deadline)
            .ThenBy(t => t.StartDateTime)
            .ToListAsync();

        return tasks.Select(t => new TaskItemDto(
            t.Id, t.Title, t.Description, t.StartDateTime, t.DurationMinutes, t.Deadline,
            t.Status, t.IsPinned, false, null, false)).ToList();
    }

    public async Task<int> GetUnassignedCountAsync(int userId)
    {
        await SweepStaleTasksAsync(userId);
        return await _db.Tasks.CountAsync(t => t.UserId == userId && t.RecurrenceRuleId == null
            && (t.Status == "Unknown" || t.Status == "Unassigned"));
    }

    public async Task<List<TaskItemDto>> GetReminderAsync(int userId)
    {
        var yesterday = Today.AddDays(-1);
        var tasks = await _db.Tasks
            .Where(t => t.UserId == userId && t.RecurrenceRuleId == null && t.Status == "Planned"
                && t.StartDateTime != null && t.StartDateTime.Value.Date == yesterday)
            .OrderBy(t => t.StartDateTime)
            .ToListAsync();

        return tasks.Select(t => new TaskItemDto(
            t.Id, t.Title, t.Description, t.StartDateTime, t.DurationMinutes, t.Deadline,
            t.Status, t.IsPinned, false, null, false)).ToList();
    }

    public async Task<bool> ResolveTaskAsync(int userId, int taskId, string action)
    {
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == taskId && t.UserId == userId);
        if (task is null) return false;

        task.Status = action switch
        {
            "Done" => "Done",
            "Skipped" => "Skipped",
            "Postpone" => "Unassigned",
            _ => task.Status,
        };
        await _db.SaveChangesAsync();
        return true;
    }

    // ---- CRUD одноразової задачі -----------------------------------------------------------

    public async Task<TaskItem> CreateTaskAsync(
        int userId, string title, string? description, DateTime? startDateTime, int? durationMinutes, DateTime? deadline)
    {
        var task = new TaskItem
        {
            UserId = userId,
            Title = title,
            Description = description,
            StartDateTime = startDateTime,
            DurationMinutes = durationMinutes,
            Deadline = deadline,
            Status = startDateTime is null ? "Unassigned" : "Planned",
        };
        _db.Tasks.Add(task);
        await _db.SaveChangesAsync();
        return task;
    }

    public async Task<bool> UpdateTaskAsync(
        int userId, int taskId, string title, string? description, DateTime? startDateTime, int? durationMinutes, DateTime? deadline)
    {
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == taskId && t.UserId == userId && t.RecurrenceRuleId == null);
        if (task is null) return false;

        task.Title = title;
        task.Description = description;
        task.StartDateTime = startDateTime;
        task.DurationMinutes = durationMinutes;
        task.Deadline = deadline;
        // Перенесення (Move з Нерозподілених) повертає задачу в план, навіть якщо вона стала Unknown
        if (startDateTime is not null) task.Status = "Planned";

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteTaskAsync(int userId, int taskId)
    {
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == taskId && t.UserId == userId && t.RecurrenceRuleId == null);
        if (task is null) return false;
        _db.Tasks.Remove(task);
        await _db.SaveChangesAsync();
        return true;
    }

    // ---- CRUD правил повторення ------------------------------------------------------------

    public async Task<List<RecurrenceRuleDto>> GetRecurrenceRulesAsync(int userId)
    {
        var rules = await _db.RecurrenceRules.Include(r => r.Exceptions)
            .Where(r => r.UserId == userId).ToListAsync();
        var templates = await _db.Tasks
            .Where(t => t.UserId == userId && t.RecurrenceRuleId != null).ToListAsync();
        var templateByRuleId = templates.ToDictionary(t => t.RecurrenceRuleId!.Value);

        return rules
            .Where(r => templateByRuleId.ContainsKey(r.Id))
            .Select(r =>
            {
                var t = templateByRuleId[r.Id];
                return new RecurrenceRuleDto(
                    r.Id, t.Id, t.Title, t.Description, t.DurationMinutes,
                    r.Pattern, r.DaysOfWeek, r.TimeOfDay, r.StartDate, r.EndDate,
                    r.Exceptions.Select(e => new RecurrenceExceptionDto(e.Id, e.Date, e.ExceptionType, e.NewDateTime)).ToList());
            })
            .ToList();
    }

    public async Task<RecurrenceRuleDto> CreateRecurrenceRuleAsync(
        int userId, string title, string? description, int? durationMinutes,
        string pattern, string? daysOfWeek, TimeOnly timeOfDay, DateOnly startDate, DateOnly? endDate)
    {
        var rule = new RecurrenceRule
        {
            UserId = userId,
            Pattern = pattern,
            DaysOfWeek = daysOfWeek,
            TimeOfDay = timeOfDay,
            StartDate = startDate,
            EndDate = endDate,
        };
        _db.RecurrenceRules.Add(rule);
        await _db.SaveChangesAsync(); // потрібен Id правила для шаблон-задачі нижче

        var template = new TaskItem
        {
            UserId = userId,
            Title = title,
            Description = description,
            DurationMinutes = durationMinutes,
            StartDateTime = startDate.ToDateTime(timeOfDay),
            RecurrenceRuleId = rule.Id,
        };
        _db.Tasks.Add(template);
        await _db.SaveChangesAsync();

        return new RecurrenceRuleDto(
            rule.Id, template.Id, template.Title, template.Description, template.DurationMinutes,
            rule.Pattern, rule.DaysOfWeek, rule.TimeOfDay, rule.StartDate, rule.EndDate,
            new List<RecurrenceExceptionDto>());
    }

    public async Task<bool> UpdateRecurrenceRuleAsync(
        int userId, int ruleId, string title, string? description, int? durationMinutes,
        string pattern, string? daysOfWeek, TimeOnly timeOfDay, DateOnly startDate, DateOnly? endDate)
    {
        var rule = await _db.RecurrenceRules.FirstOrDefaultAsync(r => r.Id == ruleId && r.UserId == userId);
        if (rule is null) return false;
        var template = await _db.Tasks.FirstOrDefaultAsync(t => t.RecurrenceRuleId == ruleId);
        if (template is null) return false;

        rule.Pattern = pattern;
        rule.DaysOfWeek = daysOfWeek;
        rule.TimeOfDay = timeOfDay;
        rule.StartDate = startDate;
        rule.EndDate = endDate;

        template.Title = title;
        template.Description = description;
        template.DurationMinutes = durationMinutes;
        template.StartDateTime = startDate.ToDateTime(timeOfDay);

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteRecurrenceRuleAsync(int userId, int ruleId)
    {
        var rule = await _db.RecurrenceRules.FirstOrDefaultAsync(r => r.Id == ruleId && r.UserId == userId);
        if (rule is null) return false;

        var template = await _db.Tasks.FirstOrDefaultAsync(t => t.RecurrenceRuleId == ruleId);
        if (template is not null) _db.Tasks.Remove(template);
        _db.RecurrenceRules.Remove(rule); // каскад прибере винятки

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<PreviewEntry>> GetRulePreviewAsync(int userId, int ruleId, DateOnly from, DateOnly to)
    {
        var rule = await _db.RecurrenceRules.Include(r => r.Exceptions)
            .FirstOrDefaultAsync(r => r.Id == ruleId && r.UserId == userId);
        return rule is null ? new List<PreviewEntry>() : PreviewOccurrences(rule, from, to);
    }

    public async Task<RecurrenceExceptionDto?> AddExceptionAsync(
        int userId, int ruleId, DateOnly date, string exceptionType, DateTime? newDateTime)
    {
        var ruleExists = await _db.RecurrenceRules.AnyAsync(r => r.Id == ruleId && r.UserId == userId);
        if (!ruleExists) return null;

        var ex = new RecurrenceException
        {
            RecurrenceRuleId = ruleId,
            Date = date,
            ExceptionType = exceptionType,
            NewDateTime = newDateTime,
        };
        _db.RecurrenceExceptions.Add(ex);
        await _db.SaveChangesAsync();
        return new RecurrenceExceptionDto(ex.Id, ex.Date, ex.ExceptionType, ex.NewDateTime);
    }

    public async Task<bool> DeleteExceptionAsync(int userId, int ruleId, int exceptionId)
    {
        var ruleExists = await _db.RecurrenceRules.AnyAsync(r => r.Id == ruleId && r.UserId == userId);
        if (!ruleExists) return false;

        var ex = await _db.RecurrenceExceptions.FirstOrDefaultAsync(e => e.Id == exceptionId && e.RecurrenceRuleId == ruleId);
        if (ex is null) return false;

        _db.RecurrenceExceptions.Remove(ex);
        await _db.SaveChangesAsync();
        return true;
    }
}
