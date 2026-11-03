using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// Чекап здоров'я: заплановані візити до лікарів. Перелік спеціальностей — сталий (на фронтенді),
// тут зберігаємо лише DoctorKey обраного лікаря. Кожен візит створює подію в спільному календарі
// (ModuleCode="health") через TaskService — так само, як зустрічі в "Роботі".
public class CheckupService
{
    private readonly AppDbContext _db;
    private readonly TaskService _taskService;

    public CheckupService(AppDbContext db, TaskService taskService)
    {
        _db = db;
        _taskService = taskService;
    }

    public record VisitDto(int Id, string DoctorKey, DateTime When, string? Place, string? Note);

    public async Task<List<VisitDto>> GetVisitsAsync(int userId) =>
        await _db.HealthVisits
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.When)
            .Select(x => new VisitDto(x.Id, x.DoctorKey, x.When, x.Place, x.Note))
            .ToListAsync();

    public async Task<int> AddVisitAsync(int userId, string doctorKey, string doctorName, DateTime when, string? place, string? note)
    {
        var visit = new HealthVisit
        {
            UserId = userId,
            DoctorKey = (doctorKey ?? "").Trim(),
            When = when,
            Place = Trim(place),
            Note = Trim(note),
        };
        _db.HealthVisits.Add(visit);
        await _db.SaveChangesAsync(); // потрібен Id для посилання задачі на візит

        var title = VisitTitle(doctorName);
        var description = string.IsNullOrWhiteSpace(place) ? Trim(note) : (Trim(note) is string n ? $"{place.Trim()} · {n}" : place.Trim());
        var task = await _taskService.CreateTaskAsync(userId, title, description, when, null, null,
            moduleCode: "health", sourceModule: "health", sourceEntityId: visit.Id);
        visit.TaskId = task.Id;
        await _db.SaveChangesAsync();
        return visit.Id;
    }

    public async Task<bool> DeleteVisitAsync(int userId, int id)
    {
        var visit = await _db.HealthVisits.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (visit is null) return false;
        if (visit.TaskId is int taskId)
            await _taskService.DeleteTaskAsync(userId, taskId, cascadeSource: false); // запис прибираємо самі нижче
        _db.HealthVisits.Remove(visit);
        await _db.SaveChangesAsync();
        return true;
    }

    private static string VisitTitle(string? doctorName) =>
        string.IsNullOrWhiteSpace(doctorName) ? "Візит до лікаря" : $"Візит: {doctorName.Trim()}";

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
