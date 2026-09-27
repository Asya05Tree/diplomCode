namespace Server.Models;

// planner-spec.md §3.3. Названо TaskItem, а не Task — "Task" конфліктує з System.Threading.Tasks.Task
// (ImplicitUsings у Server.csproj глобально підключає цей неймспейс, і async-методи контролерів
// скрізь повертають Task<T> — власний тип з тим самим іменем зламав би компіляцію).
//
// StartDateTime — nullable: задача без дати ("не влізло") одразу потрапляє в Нерозподілені.
// Задача з RecurrenceRuleId — тільки шаблон (Title/Duration/Description для генерації інстансів
// із RecurrenceRule), сама вона як окрема подія календаря не показується.
public class TaskItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ModuleCode { get; set; } = "tasks";

    public DateTime? StartDateTime { get; set; }
    public int? DurationMinutes { get; set; }
    public DateTime? Deadline { get; set; }

    public string Status { get; set; } = "Planned"; // Planned | Done | Skipped | Unknown | Unassigned
    public bool IsPinned { get; set; }

    public int? RecurrenceRuleId { get; set; }
    public RecurrenceRule? RecurrenceRule { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
