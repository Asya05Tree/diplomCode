using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// Модуль "Навчання" (coding-guide.md §15.5). Тут — предмети, завдання, сітка дзвінків і шкала
// оцінок. Сам розклад пар НЕ дублюється: він живе як RecurrenceRule/TaskItem з ModuleCode="study"
// (цикли тижнів/винятки вже реалізовані в TaskService). Дзвінки й шкала оцінок замінюються цілою
// сіткою (PUT замість поштучного CRUD) — так простіше й відповідає тому, як це редагується в UI.
public class StudyService
{
    private readonly AppDbContext _db;

    public StudyService(AppDbContext db)
    {
        _db = db;
    }

    public record SubjectDto(int Id, string NameUk, string? NameEn, string? Teacher, string? Room, string? Color);
    public record AssignmentDto(int Id, int? SubjectId, string Type, string Title, DateOnly? DueDate, bool IsDone);
    public record BellDto(int Index, TimeOnly StartTime, TimeOnly EndTime);
    public record GradeScaleDto(int MinPercent, string Label);

    // ---- Предмети -------------------------------------------------------------

    public async Task<List<SubjectDto>> GetSubjectsAsync(int userId) =>
        await _db.StudySubjects
            .Where(x => x.UserId == userId)
            .Select(x => new SubjectDto(x.Id, x.NameUk, x.NameEn, x.Teacher, x.Room, x.Color))
            .ToListAsync();

    public async Task<int> AddSubjectAsync(int userId, string nameUk, string? nameEn, string? teacher, string? room, string? color)
    {
        var subject = new StudySubject { UserId = userId, NameUk = nameUk.Trim(), NameEn = nameEn, Teacher = teacher, Room = room, Color = color };
        _db.StudySubjects.Add(subject);
        await _db.SaveChangesAsync();
        return subject.Id;
    }

    public async Task<bool> UpdateSubjectAsync(int userId, int id, string nameUk, string? nameEn, string? teacher, string? room, string? color)
    {
        var subject = await _db.StudySubjects.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (subject is null) return false;
        subject.NameUk = nameUk.Trim();
        subject.NameEn = nameEn;
        subject.Teacher = teacher;
        subject.Room = room;
        subject.Color = color;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteSubjectAsync(int userId, int id)
    {
        var subject = await _db.StudySubjects.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (subject is null) return false;
        _db.StudySubjects.Remove(subject); // завдання лишаються, просто відвʼязуються (SetNull у моделі)
        await _db.SaveChangesAsync();
        return true;
    }

    // ---- Завдання -------------------------------------------------------------

    public async Task<List<AssignmentDto>> GetAssignmentsAsync(int userId) =>
        await _db.StudyAssignments
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.DueDate == null).ThenBy(x => x.DueDate)
            .Select(x => new AssignmentDto(x.Id, x.SubjectId, x.Type, x.Title, x.DueDate, x.IsDone))
            .ToListAsync();

    public async Task<int> AddAssignmentAsync(int userId, int? subjectId, string type, string title, DateOnly? dueDate, bool isDone)
    {
        var assignment = new StudyAssignment { UserId = userId, SubjectId = subjectId, Type = type, Title = title.Trim(), DueDate = dueDate, IsDone = isDone };
        _db.StudyAssignments.Add(assignment);
        await _db.SaveChangesAsync();
        return assignment.Id;
    }

    public async Task<bool> UpdateAssignmentAsync(int userId, int id, int? subjectId, string type, string title, DateOnly? dueDate, bool isDone)
    {
        var assignment = await _db.StudyAssignments.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (assignment is null) return false;
        assignment.SubjectId = subjectId;
        assignment.Type = type;
        assignment.Title = title.Trim();
        assignment.DueDate = dueDate;
        assignment.IsDone = isDone;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAssignmentAsync(int userId, int id)
    {
        var assignment = await _db.StudyAssignments.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (assignment is null) return false;
        _db.StudyAssignments.Remove(assignment);
        await _db.SaveChangesAsync();
        return true;
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

    // ---- Шкала оцінок (замінюємо всю шкалу) -----------------------------------

    public async Task<List<GradeScaleDto>> GetGradeScaleAsync(int userId) =>
        await _db.GradeScaleEntries
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.MinPercent)
            .Select(x => new GradeScaleDto(x.MinPercent, x.Label))
            .ToListAsync();

    public async Task ReplaceGradeScaleAsync(int userId, List<GradeScaleDto> scale)
    {
        var existing = await _db.GradeScaleEntries.Where(x => x.UserId == userId).ToListAsync();
        _db.GradeScaleEntries.RemoveRange(existing);
        foreach (var s in scale)
            _db.GradeScaleEntries.Add(new GradeScaleEntry { UserId = userId, MinPercent = s.MinPercent, Label = s.Label });
        await _db.SaveChangesAsync();
    }
}
