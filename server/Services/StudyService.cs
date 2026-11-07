using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// Модуль "Навчання". Тут — налаштування навчання, предмети, завдання, сітка дзвінків, розклад/
// консультації та великі роботи (диплом/курсова/практика). Розклад і консультації НЕ зберігаються
// як окремі події: кожен запис створює RecurrenceRule (ModuleCode="study") через TaskService, тож
// подія одразу з'являється і в розкладі, і в спільному календарі. StudyService тримає лише навчальні
// метадані + посилання на правило. Дзвінки замінюються цілою сіткою (PUT), бо так редагуються в UI.
public class StudyService
{
    private readonly AppDbContext _db;
    private readonly TaskService _taskService;

    public StudyService(AppDbContext db, TaskService taskService)
    {
        _db = db;
        _taskService = taskService;
    }

    // ---- DTO ------------------------------------------------------------------

    public record SettingsDto(string LearningForm, string TermType, DateOnly? StudyStart, DateOnly? StudyEnd,
        DateOnly? SemesterEnd, DateOnly? YearEnd, DateOnly? VacationStart, DateOnly? VacationEnd);

    public record SubjectDto(int Id, string Name, string? Teacher, string? Color,
        string? LectureRoom, string? LectureLink, string? SeminarRoom, string? SeminarLink);

    public record AssignmentDto(int Id, int? SubjectId, string? SubjectName, string? Teacher,
        string Type, string Description, string DeadlineKind, DateOnly? DueDate, DateOnly? ResolvedDeadline,
        bool IsDone, decimal? Grade);

    public record BellDto(int Index, TimeOnly StartTime, TimeOnly EndTime);

    public record ScheduleEntryDto(int Id, string EntryKind, int? SubjectId, string? SubjectName, string? Name,
        string? SessionKind, int? PairNumber, string? Form, string? Room, string? Link, int RecurrenceRuleId,
        string RuleType, TimeOnly TimeOfDay, int? CycleWeeks, string? WeekDaysPattern, DateOnly StartDate, DateOnly? EndDate);

    public record StepDto(int Id, string Name, DateOnly? StartDate, DateOnly? EndDate, bool IsDone);
    public record ProjectDto(int Id, string Kind, string Name, string? Curator, string? DeadlineKind,
        DateOnly? DueDate, DateOnly? ResolvedDeadline, int Percent, List<StepDto> Steps);

    // Параметри повторення для запису розкладу/консультації (той самий набір, що в RecurrenceRule)
    public record Recurrence(string Type, TimeOnly TimeOfDay, DateOnly StartDate, DateOnly? EndDate,
        int? CycleWeeks, DateOnly? CycleAnchorDate, string? WeekDaysPattern, string? WeekDayTimesPattern,
        int? IntervalDays, string? MonthDayMode, string? MonthDays, string? MonthDayTimesPattern);

    // ---- Налаштування навчання ------------------------------------------------

    public async Task<SettingsDto> GetSettingsAsync(int userId)
    {
        var s = await _db.StudySettings.FindAsync(userId);
        if (s is null)
        {
            // Дефолти навчального року: якщо зараз вересень+ — рік поточний, інакше попередній.
            var today = DateOnly.FromDateTime(DateTime.Today);
            var startYear = today.Month >= 9 ? today.Year : today.Year - 1;
            s = new StudySettings
            {
                UserId = userId,
                StudyStart = new DateOnly(startYear, 9, 1),
                StudyEnd = new DateOnly(startYear, 12, 31),
                SemesterEnd = new DateOnly(startYear, 12, 31),
                YearEnd = new DateOnly(startYear + 1, 5, 31),
            };
            _db.StudySettings.Add(s);
            await _db.SaveChangesAsync();
        }
        return ToSettingsDto(s);
    }

    public async Task UpdateSettingsAsync(int userId, SettingsDto dto)
    {
        var s = await _db.StudySettings.FindAsync(userId);
        if (s is null)
        {
            s = new StudySettings { UserId = userId };
            _db.StudySettings.Add(s);
        }
        s.LearningForm = Normalize(dto.LearningForm, new[] { "distance", "regular", "mixed" }, "distance");
        s.TermType = Normalize(dto.TermType, new[] { "semester", "trimester" }, "semester");
        s.StudyStart = dto.StudyStart;
        s.StudyEnd = dto.StudyEnd;
        s.SemesterEnd = dto.SemesterEnd;
        s.YearEnd = dto.YearEnd;
        s.VacationStart = dto.VacationStart;
        s.VacationEnd = dto.VacationEnd;
        await _db.SaveChangesAsync();
    }

    private static SettingsDto ToSettingsDto(StudySettings s) =>
        new(s.LearningForm, s.TermType, s.StudyStart, s.StudyEnd, s.SemesterEnd, s.YearEnd, s.VacationStart, s.VacationEnd);

    private static string Normalize(string? value, string[] allowed, string fallback) =>
        allowed.Contains(value) ? value! : fallback;

    // ---- Предмети -------------------------------------------------------------

    public async Task<List<SubjectDto>> GetSubjectsAsync(int userId) =>
        await _db.StudySubjects
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Name)
            .Select(x => new SubjectDto(x.Id, x.Name, x.Teacher, x.Color,
                x.LectureRoom, x.LectureLink, x.SeminarRoom, x.SeminarLink))
            .ToListAsync();

    public async Task<int> AddSubjectAsync(int userId, SubjectDto dto)
    {
        Limits.Ensure(await _db.StudySubjects.CountAsync(x => x.UserId == userId), Limits.StudySubjects, "study_subjects");
        var subject = new StudySubject
        {
            UserId = userId,
            Name = dto.Name.Trim(),
            Teacher = Trim(dto.Teacher),
            Color = dto.Color,
            LectureRoom = Trim(dto.LectureRoom),
            LectureLink = Trim(dto.LectureLink),
            SeminarRoom = Trim(dto.SeminarRoom),
            SeminarLink = Trim(dto.SeminarLink),
        };
        _db.StudySubjects.Add(subject);
        await _db.SaveChangesAsync();
        return subject.Id;
    }

    public async Task<bool> UpdateSubjectAsync(int userId, int id, SubjectDto dto)
    {
        var subject = await _db.StudySubjects.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (subject is null) return false;
        subject.Name = dto.Name.Trim();
        subject.Teacher = Trim(dto.Teacher);
        subject.Color = dto.Color;
        subject.LectureRoom = Trim(dto.LectureRoom);
        subject.LectureLink = Trim(dto.LectureLink);
        subject.SeminarRoom = Trim(dto.SeminarRoom);
        subject.SeminarLink = Trim(dto.SeminarLink);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteSubjectAsync(int userId, int id)
    {
        var subject = await _db.StudySubjects.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (subject is null) return false;
        _db.StudySubjects.Remove(subject); // завдання/записи розкладу просто відв'язуються (SetNull)
        await _db.SaveChangesAsync();
        return true;
    }

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    // ---- Завдання -------------------------------------------------------------

    public async Task<List<AssignmentDto>> GetAssignmentsAsync(int userId)
    {
        var settings = await _db.StudySettings.FindAsync(userId);
        var assignments = await _db.StudyAssignments
            .Where(x => x.UserId == userId)
            .Include(x => x.Subject)
            .ToListAsync();

        // Обчислюємо фактичний дедлайн для сортування/показу (semester/year беруться з налаштувань)
        return assignments
            .Select(a => new AssignmentDto(a.Id, a.SubjectId, a.Subject?.Name, a.Subject?.Teacher,
                a.Type, a.Description, a.DeadlineKind, a.DueDate,
                ResolveDeadline(a.DeadlineKind, a.DueDate, settings), a.IsDone, a.Grade))
            .OrderBy(a => a.ResolvedDeadline == null).ThenBy(a => a.ResolvedDeadline)
            .ToList();
    }

    public async Task<int> AddAssignmentAsync(int userId, int? subjectId, string type, string description,
        string deadlineKind, DateOnly? dueDate, bool isDone, decimal? grade)
    {
        Limits.Ensure(await _db.StudyAssignments.CountAsync(x => x.UserId == userId), Limits.StudyAssignments, "study_assignments");
        var assignment = new StudyAssignment
        {
            UserId = userId,
            SubjectId = subjectId,
            Type = type,
            Description = description.Trim(),
            DeadlineKind = deadlineKind,
            DueDate = deadlineKind == "date" ? dueDate : null,
            IsDone = isDone,
            Grade = isDone ? await ClampGradeAsync(userId, grade) : null,
        };
        _db.StudyAssignments.Add(assignment);
        await _db.SaveChangesAsync();
        return assignment.Id;
    }

    public async Task<bool> UpdateAssignmentAsync(int userId, int id, int? subjectId, string type, string description,
        string deadlineKind, DateOnly? dueDate, bool isDone, decimal? grade)
    {
        var a = await _db.StudyAssignments.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (a is null) return false;
        a.SubjectId = subjectId;
        a.Type = type;
        a.Description = description.Trim();
        a.DeadlineKind = deadlineKind;
        a.DueDate = deadlineKind == "date" ? dueDate : null;
        a.IsDone = isDone;
        a.Grade = isDone ? await ClampGradeAsync(userId, grade) : null;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAssignmentAsync(int userId, int id)
    {
        var a = await _db.StudyAssignments.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (a is null) return false;
        _db.StudyAssignments.Remove(a);
        await _db.SaveChangesAsync();
        return true;
    }

    // Школяр: 0 або ціле 1–12. Студент/інше: 0–100 з точністю до сотих. Захист БД навіть в обхід UI.
    private async Task<decimal?> ClampGradeAsync(int userId, decimal? grade)
    {
        if (grade is null) return null;
        var profile = await _db.UserProfiles.FindAsync(userId);
        if (profile?.StudentType == "pupil")
            return Math.Clamp((int)Math.Round(grade.Value), 0, 12);
        return Math.Round(Math.Clamp(grade.Value, 0m, 100m), 2);
    }

    private static DateOnly? ResolveDeadline(string kind, DateOnly? dueDate, StudySettings? settings)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        return kind switch
        {
            "tomorrow" => today.AddDays(1),
            // кінець поточного тижня — найближча неділя (ISO: Пн=1..Нд=7)
            "week" => today.AddDays(6 - (((int)today.DayOfWeek + 6) % 7)),
            "semester" => settings?.SemesterEnd ?? settings?.StudyEnd,
            "year" => settings?.YearEnd,
            "date" => dueDate,
            _ => null,
        };
    }

    // ---- Дзвінки (замінюємо всю сітку) ----------------------------------------

    public async Task<List<BellDto>> GetBellsAsync(int userId) =>
        await _db.BellPeriods
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Index)
            .Select(x => new BellDto(x.Index, x.StartTime, x.EndTime))
            .ToListAsync();

    public async Task ReplaceBellsAsync(int userId, List<BellDto> bells)
    {
        var existing = await _db.BellPeriods.Where(x => x.UserId == userId).ToListAsync();
        _db.BellPeriods.RemoveRange(existing);
        foreach (var b in bells)
            _db.BellPeriods.Add(new BellPeriod { UserId = userId, Index = b.Index, StartTime = b.StartTime, EndTime = b.EndTime });
        await _db.SaveChangesAsync();
    }

    // ---- Розклад / консультації / факультативи --------------------------------

    public async Task<List<ScheduleEntryDto>> GetScheduleEntriesAsync(int userId, string? kind)
    {
        var entries = await _db.StudyScheduleEntries
            .Where(x => x.UserId == userId && (kind == null || x.EntryKind == kind))
            .Include(x => x.Subject)
            .ToListAsync();

        var ruleIds = entries.Select(e => e.RecurrenceRuleId).ToList();
        var rules = await _db.RecurrenceRules
            .Where(r => r.UserId == userId && ruleIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id);

        return entries
            .Where(e => rules.ContainsKey(e.RecurrenceRuleId))
            .Select(e =>
            {
                var r = rules[e.RecurrenceRuleId];
                return new ScheduleEntryDto(e.Id, e.EntryKind, e.SubjectId, e.Subject?.Name, e.Name,
                    e.SessionKind, e.PairNumber, e.Form, e.Room, e.Link, e.RecurrenceRuleId,
                    r.Type, r.TimeOfDay, r.CycleWeeks, r.WeekDaysPattern, r.StartDate, r.EndDate);
            })
            .ToList();
    }

    public async Task<int> AddScheduleEntryAsync(int userId, string entryKind, int? subjectId, string? name,
        string? sessionKind, int? pairNumber, string? form, string? room, string? link, Recurrence rec)
    {
        Limits.Ensure(await _db.StudyScheduleEntries.CountAsync(x => x.UserId == userId),
            Limits.StudyScheduleEntries, "study_schedule");
        var subject = subjectId is int sid
            ? await _db.StudySubjects.FirstOrDefaultAsync(x => x.Id == sid && x.UserId == userId)
            : null;

        var (title, description) = BuildTitleDescription(entryKind, name, subject, sessionKind, form, room, link);

        // Правило повторення створює події календаря (ModuleCode="study") — тому запис одразу видно
        // і в розкладі, і на головному календарі.
        var rule = await _taskService.CreateRecurrenceRuleAsync(userId, title, description, null,
            rec.Type, rec.TimeOfDay, rec.StartDate, rec.EndDate,
            rec.CycleWeeks, rec.CycleAnchorDate, rec.WeekDaysPattern, rec.WeekDayTimesPattern,
            rec.IntervalDays, rec.MonthDayMode, rec.MonthDays, rec.MonthDayTimesPattern,
            moduleCode: "study");

        var entry = new StudyScheduleEntry
        {
            UserId = userId,
            EntryKind = entryKind,
            SubjectId = subject?.Id,
            Name = Trim(name),
            SessionKind = sessionKind,
            PairNumber = pairNumber,
            Form = form,
            Room = Trim(room),
            Link = Trim(link),
            RecurrenceRuleId = rule.Id,
        };
        _db.StudyScheduleEntries.Add(entry);
        await _db.SaveChangesAsync();
        return entry.Id;
    }

    public async Task<bool> UpdateScheduleEntryAsync(int userId, int id, string entryKind, int? subjectId, string? name,
        string? sessionKind, int? pairNumber, string? form, string? room, string? link, Recurrence rec)
    {
        var entry = await _db.StudyScheduleEntries.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (entry is null) return false;

        var subject = subjectId is int sid
            ? await _db.StudySubjects.FirstOrDefaultAsync(x => x.Id == sid && x.UserId == userId)
            : null;
        var (title, description) = BuildTitleDescription(entryKind, name, subject, sessionKind, form, room, link);

        var ruleUpdated = await _taskService.UpdateRecurrenceRuleAsync(userId, entry.RecurrenceRuleId, title, description, null,
            rec.Type, rec.TimeOfDay, rec.StartDate, rec.EndDate,
            rec.CycleWeeks, rec.CycleAnchorDate, rec.WeekDaysPattern, rec.WeekDayTimesPattern,
            rec.IntervalDays, rec.MonthDayMode, rec.MonthDays, rec.MonthDayTimesPattern);
        if (!ruleUpdated) return false;

        entry.EntryKind = entryKind;
        entry.SubjectId = subject?.Id;
        entry.Name = Trim(name);
        entry.SessionKind = sessionKind;
        entry.PairNumber = pairNumber;
        entry.Form = form;
        entry.Room = Trim(room);
        entry.Link = Trim(link);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteScheduleEntryAsync(int userId, int id)
    {
        var entry = await _db.StudyScheduleEntries.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (entry is null) return false;
        // Спершу прибираємо правило разом із шаблон-задачею, далі сам запис
        await _taskService.DeleteRecurrenceRuleAsync(userId, entry.RecurrenceRuleId);
        _db.StudyScheduleEntries.Remove(entry);
        await _db.SaveChangesAsync();
        return true;
    }

    // Заголовок і опис шаблон-задачі: щоб картка в календарі показувала викладача й кабінет/посилання.
    private static (string title, string? description) BuildTitleDescription(string entryKind, string? name,
        StudySubject? subject, string? sessionKind, string? form, string? room, string? link)
    {
        var title = !string.IsNullOrWhiteSpace(name) ? name!.Trim() : subject?.Name ?? "Заняття";

        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(subject?.Teacher)) parts.Add(subject!.Teacher!);

        if (entryKind == "lesson" && subject is not null)
        {
            // Пара бере кабінет/посилання з предмета за типом заняття (лекція/семінар)
            var isSeminar = sessionKind == "seminar";
            var r = isSeminar ? subject.SeminarRoom : subject.LectureRoom;
            var l = isSeminar ? subject.SeminarLink : subject.LectureLink;
            if (!string.IsNullOrWhiteSpace(r)) parts.Add(r!);
            if (!string.IsNullOrWhiteSpace(l)) parts.Add(l!);
        }
        else
        {
            // Консультація/факультатив — власні кабінет/посилання
            if (!string.IsNullOrWhiteSpace(room)) parts.Add(room!);
            if (!string.IsNullOrWhiteSpace(link)) parts.Add(link!);
        }

        return (title, parts.Count > 0 ? string.Join(" · ", parts) : null);
    }

    // ---- Великі роботи (диплом / курсова / практика) --------------------------

    public async Task<List<ProjectDto>> GetProjectsAsync(int userId, string? kind)
    {
        var settings = await _db.StudySettings.FindAsync(userId);
        var projects = await _db.StudyProjects
            .Where(x => x.UserId == userId && (kind == null || x.Kind == kind))
            .Include(x => x.Steps)
            .ToListAsync();

        return projects.Select(p => ToProjectDto(p, settings)).OrderBy(p => p.Kind).ThenBy(p => p.Name).ToList();
    }

    public async Task<int> AddProjectAsync(int userId, string kind, string name, string? curator,
        string? deadlineKind, DateOnly? dueDate)
    {
        Limits.Ensure(await _db.StudyProjects.CountAsync(x => x.UserId == userId), Limits.StudyProjects, "study_projects");
        var project = new StudyProject
        {
            UserId = userId,
            Kind = kind,
            Name = name.Trim(),
            Curator = Trim(curator),
            DeadlineKind = deadlineKind,
            DueDate = deadlineKind == "date" ? dueDate : null,
        };
        _db.StudyProjects.Add(project);
        await _db.SaveChangesAsync();
        return project.Id;
    }

    public async Task<bool> UpdateProjectAsync(int userId, int id, string name, string? curator,
        string? deadlineKind, DateOnly? dueDate)
    {
        var p = await _db.StudyProjects.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (p is null) return false;
        p.Name = name.Trim();
        p.Curator = Trim(curator);
        p.DeadlineKind = deadlineKind;
        p.DueDate = deadlineKind == "date" ? dueDate : null;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteProjectAsync(int userId, int id)
    {
        var p = await _db.StudyProjects.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (p is null) return false;
        _db.StudyProjects.Remove(p); // кроки підуть каскадом
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int?> AddStepAsync(int userId, int projectId, string name, DateOnly? start, DateOnly? end, bool isDone)
    {
        var owns = await _db.StudyProjects.AnyAsync(x => x.Id == projectId && x.UserId == userId);
        if (!owns) return null;
        Limits.Ensure(await _db.StudyProjectSteps.CountAsync(s => s.ProjectId == projectId),
            Limits.StudyStepsPerProject, "study_steps");
        var step = new StudyProjectStep { ProjectId = projectId, Name = name.Trim(), StartDate = start, EndDate = end, IsDone = isDone };
        _db.StudyProjectSteps.Add(step);
        await _db.SaveChangesAsync();
        return step.Id;
    }

    public async Task<bool> UpdateStepAsync(int userId, int stepId, string name, DateOnly? start, DateOnly? end, bool isDone)
    {
        var step = await _db.StudyProjectSteps.Include(s => s.Project)
            .FirstOrDefaultAsync(s => s.Id == stepId && s.Project!.UserId == userId);
        if (step is null) return false;
        step.Name = name.Trim();
        step.StartDate = start;
        step.EndDate = end;
        step.IsDone = isDone;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteStepAsync(int userId, int stepId)
    {
        var step = await _db.StudyProjectSteps.Include(s => s.Project)
            .FirstOrDefaultAsync(s => s.Id == stepId && s.Project!.UserId == userId);
        if (step is null) return false;
        _db.StudyProjectSteps.Remove(step);
        await _db.SaveChangesAsync();
        return true;
    }

    private static ProjectDto ToProjectDto(StudyProject p, StudySettings? settings)
    {
        var total = p.Steps.Count;
        var done = p.Steps.Count(s => s.IsDone);
        var percent = total == 0 ? 0 : (int)Math.Round(done * 100.0 / total);
        var steps = p.Steps
            .OrderBy(s => s.StartDate == null).ThenBy(s => s.StartDate).ThenBy(s => s.Id)
            .Select(s => new StepDto(s.Id, s.Name, s.StartDate, s.EndDate, s.IsDone))
            .ToList();
        return new ProjectDto(p.Id, p.Kind, p.Name, p.Curator, p.DeadlineKind, p.DueDate,
            ResolveDeadline(p.DeadlineKind ?? "", p.DueDate, settings), percent, steps);
    }
}
