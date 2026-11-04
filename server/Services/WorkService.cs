using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// Модуль "Робота". Профіль роботи (назва/посада/роботодавець/оплата), типи змін, графік, контакти,
// відсутності (відпустки/лікарняні), зустрічі та зобов'язання. Графік і зустрічі НЕ зберігаються як
// окремі події: графік створює RecurrenceRule (ModuleCode="work"), зустріч — одноразову задачу
// (ModuleCode="work"), тож і те, і те видно в спільному календарі. Логіка самих подій — у TaskService.
public class WorkService
{
    private readonly AppDbContext _db;
    private readonly TaskService _taskService;

    public WorkService(AppDbContext db, TaskService taskService)
    {
        _db = db;
        _taskService = taskService;
    }

    // ---- DTO ------------------------------------------------------------------

    public record SettingsDto(string JobName, string? Position, string? Employer, string PayType, decimal? Rate,
        string Regime, string Workplace, decimal? NormHours, bool FullRateRetained, int? ExtraVacationDays);

    public record ShiftTypeDto(int Id, string Name, string Color, TimeOnly StartTime, TimeOnly EndTime,
        string Kind, TimeOnly? StartTime2, TimeOnly? EndTime2, decimal? OnCallMultiplier, bool IsActive);

    public record ShiftEntryDto(int Id, int ShiftTypeId, string ShiftTypeName, string Color,
        TimeOnly StartTime, TimeOnly EndTime, int RecurrenceRuleId, string RuleType, TimeOnly TimeOfDay,
        int? CycleWeeks, string? WeekDaysPattern, int? IntervalDays, string? MonthDayMode, string? MonthDays,
        DateOnly StartDate, DateOnly? EndDate, string Kind, TimeOnly? StartTime2, TimeOnly? EndTime2);

    public record CalendarShiftDto(DateOnly Date, int ShiftTypeId, string Name, string Color,
        TimeOnly StartTime, TimeOnly EndTime, string Kind, TimeOnly? StartTime2, TimeOnly? EndTime2,
        decimal? OnCallMultiplier);

    public record NextShiftDto(DateOnly Date, string Name, string Color, TimeOnly StartTime, TimeOnly EndTime,
        string Kind, TimeOnly? StartTime2, TimeOnly? EndTime2);

    public record ContactDto(int Id, string GroupName, string Status, string FullName, string Phone,
        string? Email, DateOnly? Birthday, string? Socials, string? Telegram, string? Viber);

    public record LeaveDto(int Id, string Type, DateOnly StartDate, DateOnly EndDate);

    public record MeetingDto(int Id, string WithWhom, DateTime When, string? Place);

    public record ObligationDto(int Id, string Title, string? Note, DateOnly? DueDate, bool IsDone);

    public record ProcessTaskDto(int Id, string Title, string? Note, string Status, DateOnly? DueDate);

    // Параметри повторення для запису графіка (той самий набір, що в RecurrenceRule)
    public record Recurrence(string Type, TimeOnly TimeOfDay, DateOnly StartDate, DateOnly? EndDate,
        int? CycleWeeks, DateOnly? CycleAnchorDate, string? WeekDaysPattern, string? WeekDayTimesPattern,
        int? IntervalDays, string? MonthDayMode, string? MonthDays, string? MonthDayTimesPattern);

    private static string Normalize(string? value, string[] allowed, string fallback) =>
        allowed.Contains(value) ? value! : fallback;

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    // Телефони зберігаються одним рядком через кому: лишаємо до 3 унікальних номерів.
    private static string NormalizePhones(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        var parts = raw
            .Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct()
            .Take(3);
        return string.Join(", ", parts);
    }

    // Допустимі значення режимів/видів (решта зводиться до безпечного дефолту)
    private static readonly string[] PayTypes = { "hourly", "monthly", "project" };
    private static readonly string[] Regimes =
        { "standard", "flexible", "irregular", "split", "rotational", "parttime", "reduced", "project", "oncall" };
    private static readonly string[] Workplaces = { "onsite", "remote", "home" };
    private static readonly string[] ShiftKinds = { "normal", "flexible", "split", "oncall" };

    // ---- Профіль роботи -------------------------------------------------------

    public async Task<SettingsDto> GetSettingsAsync(int userId)
    {
        var s = await _db.WorkSettings.FindAsync(userId);
        if (s is null)
        {
            s = new WorkSettings { UserId = userId };
            _db.WorkSettings.Add(s);
            await _db.SaveChangesAsync();
        }
        return new SettingsDto(s.JobName, s.Position, s.Employer, s.PayType, s.Rate,
            s.Regime, s.Workplace, s.NormHours, s.FullRateRetained, s.ExtraVacationDays);
    }

    public async Task UpdateSettingsAsync(int userId, SettingsDto dto)
    {
        var s = await _db.WorkSettings.FindAsync(userId);
        if (s is null)
        {
            s = new WorkSettings { UserId = userId };
            _db.WorkSettings.Add(s);
        }
        s.JobName = (dto.JobName ?? "").Trim();
        s.Position = Trim(dto.Position);
        s.Employer = Trim(dto.Employer);
        s.PayType = Normalize(dto.PayType, PayTypes, "hourly");
        s.Rate = dto.Rate is > 0 ? dto.Rate : null;
        s.Regime = Normalize(dto.Regime, Regimes, "standard");
        s.Workplace = Normalize(dto.Workplace, Workplaces, "onsite");
        s.NormHours = dto.NormHours is > 0 ? dto.NormHours : null;
        s.FullRateRetained = dto.FullRateRetained;
        s.ExtraVacationDays = dto.ExtraVacationDays is > 0 ? dto.ExtraVacationDays : null;
        await _db.SaveChangesAsync();
    }

    // ---- Типи змін ------------------------------------------------------------

    public async Task<List<ShiftTypeDto>> GetShiftTypesAsync(int userId) =>
        await _db.WorkShiftTypes
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.StartTime)
            .Select(x => new ShiftTypeDto(x.Id, x.Name, x.Color, x.StartTime, x.EndTime,
                x.Kind, x.StartTime2, x.EndTime2, x.OnCallMultiplier, x.IsActive))
            .ToListAsync();

    // Приводить поля виду до узгодженого стану: друга частина — лише для split, коефіцієнт — лише для oncall
    private static void ApplyKind(WorkShiftType type, ShiftTypeDto dto)
    {
        type.Kind = Normalize(dto.Kind, ShiftKinds, "normal");
        type.StartTime2 = type.Kind == "split" ? dto.StartTime2 : null;
        type.EndTime2 = type.Kind == "split" ? dto.EndTime2 : null;
        type.OnCallMultiplier = type.Kind == "oncall" && dto.OnCallMultiplier is > 0 ? dto.OnCallMultiplier : null;
    }

    public async Task<int> AddShiftTypeAsync(int userId, ShiftTypeDto dto)
    {
        var type = new WorkShiftType
        {
            UserId = userId,
            Name = dto.Name.Trim(),
            Color = dto.Color,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            IsActive = dto.IsActive,
        };
        ApplyKind(type, dto);
        _db.WorkShiftTypes.Add(type);
        await _db.SaveChangesAsync();
        return type.Id;
    }

    public async Task<bool> UpdateShiftTypeAsync(int userId, int id, ShiftTypeDto dto)
    {
        var type = await _db.WorkShiftTypes.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (type is null) return false;
        type.Name = dto.Name.Trim();
        type.Color = dto.Color;
        type.StartTime = dto.StartTime;
        type.EndTime = dto.EndTime;
        type.IsActive = dto.IsActive;
        ApplyKind(type, dto);

        // Синхронізуємо заголовок/опис шаблон-задач залежних правил, щоб календар не відставав
        var entries = await _db.WorkShiftEntries.Where(e => e.UserId == userId && e.ShiftTypeId == id).ToListAsync();
        foreach (var e in entries)
        {
            var rule = await _db.RecurrenceRules.FirstOrDefaultAsync(r => r.Id == e.RecurrenceRuleId && r.UserId == userId);
            if (rule is null) continue;
            await _taskService.UpdateRecurrenceRuleAsync(userId, rule.Id, type.Name, BuildShiftDescription(type), null,
                rule.Type, type.StartTime, rule.StartDate, rule.EndDate,
                rule.CycleWeeks, rule.CycleAnchorDate, rule.WeekDaysPattern, rule.WeekDayTimesPattern,
                rule.IntervalDays, rule.MonthDayMode, rule.MonthDays, rule.MonthDayTimesPattern);
        }
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteShiftTypeAsync(int userId, int id)
    {
        var type = await _db.WorkShiftTypes.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (type is null) return false;

        // Спершу прибираємо залежні записи графіка разом із їхніми правилами (ShiftType — Restrict)
        var entries = await _db.WorkShiftEntries.Where(e => e.UserId == userId && e.ShiftTypeId == id).ToListAsync();
        foreach (var e in entries)
        {
            await _taskService.DeleteRecurrenceRuleAsync(userId, e.RecurrenceRuleId);
            _db.WorkShiftEntries.Remove(e);
        }
        _db.WorkShiftTypes.Remove(type);
        await _db.SaveChangesAsync();
        return true;
    }

    // Опис події календаря для зміни з урахуванням виду: розділений день показує обидві частини,
    // чергування/гнучка зміна — відповідну позначку (текст статичний, як опис шаблон-задачі)
    private static string BuildShiftDescription(WorkShiftType type)
    {
        var main = $"{type.StartTime:HH\\:mm}–{type.EndTime:HH\\:mm}";
        if (type.Kind == "split" && type.StartTime2 is TimeOnly s2 && type.EndTime2 is TimeOnly e2)
            return $"{main}, {s2:HH\\:mm}–{e2:HH\\:mm}";
        if (type.Kind == "oncall") return $"{main} (чергування)";
        if (type.Kind == "flexible") return $"{main} (гнучко)";
        return main;
    }

    // ---- Записи графіка -------------------------------------------------------

    public async Task<List<ShiftEntryDto>> GetScheduleEntriesAsync(int userId)
    {
        var entries = await _db.WorkShiftEntries
            .Where(x => x.UserId == userId)
            .Include(x => x.ShiftType)
            .ToListAsync();

        var ruleIds = entries.Select(e => e.RecurrenceRuleId).ToList();
        var rules = await _db.RecurrenceRules
            .Where(r => r.UserId == userId && ruleIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id);

        return entries
            .Where(e => e.ShiftType is not null && rules.ContainsKey(e.RecurrenceRuleId))
            .Select(e =>
            {
                var r = rules[e.RecurrenceRuleId];
                var t = e.ShiftType!;
                return new ShiftEntryDto(e.Id, t.Id, t.Name, t.Color, t.StartTime, t.EndTime,
                    e.RecurrenceRuleId, r.Type, r.TimeOfDay, r.CycleWeeks, r.WeekDaysPattern,
                    r.IntervalDays, r.MonthDayMode, r.MonthDays, r.StartDate, r.EndDate,
                    t.Kind, t.StartTime2, t.EndTime2);
            })
            .ToList();
    }

    public async Task<int?> AddScheduleEntryAsync(int userId, int shiftTypeId, Recurrence rec)
    {
        var type = await _db.WorkShiftTypes.FirstOrDefaultAsync(x => x.Id == shiftTypeId && x.UserId == userId);
        if (type is null) return null;

        // Час правила = початок зміни, тож подія стає на початок зміни; опис — проміжок часу
        var rule = await _taskService.CreateRecurrenceRuleAsync(userId, type.Name, BuildShiftDescription(type), null,
            rec.Type, type.StartTime, rec.StartDate, rec.EndDate,
            rec.CycleWeeks, rec.CycleAnchorDate, rec.WeekDaysPattern, rec.WeekDayTimesPattern,
            rec.IntervalDays, rec.MonthDayMode, rec.MonthDays, rec.MonthDayTimesPattern,
            moduleCode: "work");

        var entry = new WorkShiftEntry { UserId = userId, ShiftTypeId = type.Id, RecurrenceRuleId = rule.Id };
        _db.WorkShiftEntries.Add(entry);
        await _db.SaveChangesAsync();
        return entry.Id;
    }

    public async Task<bool> UpdateScheduleEntryAsync(int userId, int id, int shiftTypeId, Recurrence rec)
    {
        var entry = await _db.WorkShiftEntries.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (entry is null) return false;
        var type = await _db.WorkShiftTypes.FirstOrDefaultAsync(x => x.Id == shiftTypeId && x.UserId == userId);
        if (type is null) return false;

        var ok = await _taskService.UpdateRecurrenceRuleAsync(userId, entry.RecurrenceRuleId, type.Name, BuildShiftDescription(type), null,
            rec.Type, type.StartTime, rec.StartDate, rec.EndDate,
            rec.CycleWeeks, rec.CycleAnchorDate, rec.WeekDaysPattern, rec.WeekDayTimesPattern,
            rec.IntervalDays, rec.MonthDayMode, rec.MonthDays, rec.MonthDayTimesPattern);
        if (!ok) return false;

        entry.ShiftTypeId = type.Id;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteScheduleEntryAsync(int userId, int id)
    {
        var entry = await _db.WorkShiftEntries.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (entry is null) return false;
        await _taskService.DeleteRecurrenceRuleAsync(userId, entry.RecurrenceRuleId);
        _db.WorkShiftEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return true;
    }

    // ---- Календар змін (для сітки графіка) й наступна зміна --------------------

    private async Task<List<(WorkShiftType Type, RecurrenceRule Rule)>> LoadEntriesWithRulesAsync(int userId)
    {
        var entries = await _db.WorkShiftEntries.Where(x => x.UserId == userId).Include(x => x.ShiftType).ToListAsync();
        var ruleIds = entries.Select(e => e.RecurrenceRuleId).ToList();
        var rules = await _db.RecurrenceRules
            .Include(r => r.Exceptions).Include(r => r.ManualDates)
            .Where(r => r.UserId == userId && ruleIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id);

        return entries
            .Where(e => e.ShiftType is not null && e.ShiftType.IsActive && rules.ContainsKey(e.RecurrenceRuleId))
            .Select(e => (e.ShiftType!, rules[e.RecurrenceRuleId]))
            .ToList();
    }

    public async Task<List<CalendarShiftDto>> GetScheduleCalendarAsync(int userId, DateOnly from, DateOnly to)
    {
        var pairs = await LoadEntriesWithRulesAsync(userId);
        var result = new List<CalendarShiftDto>();
        foreach (var (type, rule) in pairs)
            foreach (var dt in TaskService.GetEffectiveOccurrences(rule, from, to))
                result.Add(new CalendarShiftDto(DateOnly.FromDateTime(dt), type.Id, type.Name, type.Color,
                    type.StartTime, type.EndTime, type.Kind, type.StartTime2, type.EndTime2, type.OnCallMultiplier));
        return result.OrderBy(x => x.Date).ThenBy(x => x.StartTime).ToList();
    }

    public async Task<NextShiftDto?> GetNextShiftAsync(int userId)
    {
        var now = DateTime.Now;
        var today = DateOnly.FromDateTime(now);
        var pairs = await LoadEntriesWithRulesAsync(userId);

        NextShiftDto? best = null;
        DateTime bestAt = DateTime.MaxValue;
        foreach (var (type, rule) in pairs)
        {
            foreach (var dt in TaskService.GetEffectiveOccurrences(rule, today, today.AddDays(120)))
            {
                if (dt >= now && dt < bestAt)
                {
                    bestAt = dt;
                    best = new NextShiftDto(DateOnly.FromDateTime(dt), type.Name, type.Color, type.StartTime, type.EndTime,
                        type.Kind, type.StartTime2, type.EndTime2);
                }
            }
        }
        return best;
    }

    // ---- Контакти -------------------------------------------------------------

    public async Task<List<ContactDto>> GetContactsAsync(int userId) =>
        await _db.WorkContacts
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.FullName)
            .Select(x => new ContactDto(x.Id, x.GroupName, x.Status, x.FullName, x.Phone, x.Email, x.Birthday, x.Socials, x.Telegram, x.Viber))
            .ToListAsync();

    public async Task<int> AddContactAsync(int userId, ContactDto dto)
    {
        var c = new WorkContact
        {
            UserId = userId,
            GroupName = (dto.GroupName ?? "").Trim(),
            Status = Normalize(dto.Status, new[] { "online", "busy", "offline", "vacation" }, "online"),
            FullName = dto.FullName.Trim(),
            Phone = NormalizePhones(dto.Phone),
            Email = Trim(dto.Email),
            Birthday = dto.Birthday,
            Socials = Trim(dto.Socials),
            Telegram = Trim(dto.Telegram),
            Viber = Trim(dto.Viber),
        };
        _db.WorkContacts.Add(c);
        await _db.SaveChangesAsync();
        return c.Id;
    }

    public async Task<bool> UpdateContactAsync(int userId, int id, ContactDto dto)
    {
        var c = await _db.WorkContacts.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (c is null) return false;
        c.GroupName = (dto.GroupName ?? "").Trim();
        c.Status = Normalize(dto.Status, new[] { "online", "busy", "offline", "vacation" }, "online");
        c.FullName = dto.FullName.Trim();
        c.Phone = NormalizePhones(dto.Phone);
        c.Email = Trim(dto.Email);
        c.Birthday = dto.Birthday;
        c.Socials = Trim(dto.Socials);
        c.Telegram = Trim(dto.Telegram);
        c.Viber = Trim(dto.Viber);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteContactAsync(int userId, int id)
    {
        var c = await _db.WorkContacts.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (c is null) return false;
        _db.WorkContacts.Remove(c);
        await _db.SaveChangesAsync();
        return true;
    }

    // ---- Відсутності (відпустки / лікарняні) ----------------------------------

    public async Task<List<LeaveDto>> GetLeavesAsync(int userId) =>
        await _db.WorkLeaves
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.StartDate)
            .Select(x => new LeaveDto(x.Id, x.Type, x.StartDate, x.EndDate))
            .ToListAsync();

    public async Task<int> AddLeaveAsync(int userId, LeaveDto dto)
    {
        var (start, end) = OrderDates(dto.StartDate, dto.EndDate);
        var l = new WorkLeave
        {
            UserId = userId,
            Type = Normalize(dto.Type, new[] { "vacation", "sick" }, "vacation"),
            StartDate = start,
            EndDate = end,
        };
        _db.WorkLeaves.Add(l);
        await _db.SaveChangesAsync();
        return l.Id;
    }

    public async Task<bool> UpdateLeaveAsync(int userId, int id, LeaveDto dto)
    {
        var l = await _db.WorkLeaves.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (l is null) return false;
        var (start, end) = OrderDates(dto.StartDate, dto.EndDate);
        l.Type = Normalize(dto.Type, new[] { "vacation", "sick" }, "vacation");
        l.StartDate = start;
        l.EndDate = end;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteLeaveAsync(int userId, int id)
    {
        var l = await _db.WorkLeaves.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (l is null) return false;
        _db.WorkLeaves.Remove(l);
        await _db.SaveChangesAsync();
        return true;
    }

    private static (DateOnly, DateOnly) OrderDates(DateOnly a, DateOnly b) => a <= b ? (a, b) : (b, a);

    // ---- Зустрічі (синхронізуються з календарем задачею ModuleCode="work") ----

    public async Task<List<MeetingDto>> GetMeetingsAsync(int userId) =>
        await _db.WorkMeetings
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.When)
            .Select(x => new MeetingDto(x.Id, x.WithWhom, x.When, x.Place))
            .ToListAsync();

    public async Task<int> AddMeetingAsync(int userId, string withWhom, DateTime when, string? place)
    {
        var meeting = new WorkMeeting { UserId = userId, WithWhom = withWhom.Trim(), When = when, Place = Trim(place) };
        _db.WorkMeetings.Add(meeting);
        await _db.SaveChangesAsync(); // потрібен Id для посилання задачі на зустріч

        var task = await _taskService.CreateTaskAsync(userId, MeetingTitle(meeting.WithWhom), meeting.Place, when, null, null,
            moduleCode: "work", sourceModule: "work", sourceEntityId: meeting.Id);
        meeting.TaskId = task.Id;
        await _db.SaveChangesAsync();
        return meeting.Id;
    }

    public async Task<bool> UpdateMeetingAsync(int userId, int id, string withWhom, DateTime when, string? place)
    {
        var meeting = await _db.WorkMeetings.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (meeting is null) return false;
        meeting.WithWhom = withWhom.Trim();
        meeting.When = when;
        meeting.Place = Trim(place);

        if (meeting.TaskId is int taskId)
            await _taskService.UpdateTaskAsync(userId, taskId, MeetingTitle(meeting.WithWhom), meeting.Place, when, null, null);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteMeetingAsync(int userId, int id)
    {
        var meeting = await _db.WorkMeetings.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (meeting is null) return false;
        if (meeting.TaskId is int taskId)
            await _taskService.DeleteTaskAsync(userId, taskId, cascadeSource: false); // запис прибираємо самі нижче
        _db.WorkMeetings.Remove(meeting);
        await _db.SaveChangesAsync();
        return true;
    }

    private static string MeetingTitle(string withWhom) =>
        string.IsNullOrWhiteSpace(withWhom) ? "Зустріч" : $"Зустріч: {withWhom}";

    // ---- Зобов'язання / планування --------------------------------------------

    public async Task<List<ObligationDto>> GetObligationsAsync(int userId) =>
        await _db.WorkObligations
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.IsDone)
            .ThenBy(x => x.DueDate == null)
            .ThenBy(x => x.DueDate)
            .Select(x => new ObligationDto(x.Id, x.Title, x.Note, x.DueDate, x.IsDone))
            .ToListAsync();

    public async Task<int> AddObligationAsync(int userId, string title, string? note, DateOnly? dueDate)
    {
        var o = new WorkObligation { UserId = userId, Title = title.Trim(), Note = Trim(note), DueDate = dueDate };
        _db.WorkObligations.Add(o);
        await _db.SaveChangesAsync();
        return o.Id;
    }

    public async Task<bool> UpdateObligationAsync(int userId, int id, string title, string? note, DateOnly? dueDate, bool isDone)
    {
        var o = await _db.WorkObligations.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (o is null) return false;
        o.Title = title.Trim();
        o.Note = Trim(note);
        o.DueDate = dueDate;
        o.IsDone = isDone;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteObligationAsync(int userId, int id)
    {
        var o = await _db.WorkObligations.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (o is null) return false;
        _db.WorkObligations.Remove(o);
        await _db.SaveChangesAsync();
        return true;
    }

    // ---- Планування процесу (to-do з колонками; дедлайн синхронізується з календарем) ----------

    private static readonly string[] ProcessStatuses = { "planned", "doing", "done" };

    public async Task<List<ProcessTaskDto>> GetProcessTasksAsync(int userId) =>
        await _db.WorkProcessTasks
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.DueDate == null)
            .ThenBy(x => x.DueDate)
            .ThenBy(x => x.Id)
            .Select(x => new ProcessTaskDto(x.Id, x.Title, x.Note, x.Status, x.DueDate))
            .ToListAsync();

    public async Task<int> AddProcessTaskAsync(int userId, string title, string? note, string status, DateOnly? dueDate)
    {
        var p = new WorkProcessTask
        {
            UserId = userId,
            Title = title.Trim(),
            Note = Trim(note),
            Status = Normalize(status, ProcessStatuses, "planned"),
            DueDate = dueDate,
        };
        _db.WorkProcessTasks.Add(p);
        await _db.SaveChangesAsync();
        await SyncProcessCalendarAsync(userId, p);
        await _db.SaveChangesAsync();
        return p.Id;
    }

    public async Task<bool> UpdateProcessTaskAsync(int userId, int id, string title, string? note, string status, DateOnly? dueDate)
    {
        var p = await _db.WorkProcessTasks.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (p is null) return false;
        p.Title = title.Trim();
        p.Note = Trim(note);
        p.Status = Normalize(status, ProcessStatuses, "planned");
        p.DueDate = dueDate;
        await SyncProcessCalendarAsync(userId, p);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteProcessTaskAsync(int userId, int id)
    {
        var p = await _db.WorkProcessTasks.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (p is null) return false;
        if (p.TaskId is int taskId)
            await _taskService.DeleteTaskAsync(userId, taskId, cascadeSource: false);
        _db.WorkProcessTasks.Remove(p);
        await _db.SaveChangesAsync();
        return true;
    }

    // Подію на дедлайн тримаємо в календарі, лише доки задача має дату й не виконана. Інакше — прибираємо.
    private async Task SyncProcessCalendarAsync(int userId, WorkProcessTask p)
    {
        var shouldHave = p.DueDate is not null && p.Status != "done";
        var title = $"Задача: {p.Title}";
        if (shouldHave)
        {
            var when = p.DueDate!.Value.ToDateTime(new TimeOnly(9, 0));
            if (p.TaskId is int taskId)
            {
                await _taskService.UpdateTaskAsync(userId, taskId, title, p.Note, when, null, when);
            }
            else
            {
                var task = await _taskService.CreateTaskAsync(userId, title, p.Note, when, null, when,
                    moduleCode: "work", sourceModule: "work-process", sourceEntityId: p.Id);
                p.TaskId = task.Id;
            }
        }
        else if (p.TaskId is int taskId)
        {
            await _taskService.DeleteTaskAsync(userId, taskId, cascadeSource: false);
            p.TaskId = null;
        }
    }
}
