namespace Server.Models;

// planner-spec.md §3.3. Повторювані задачі не розгортаються в БД — зберігається одне правило
// + винятки, конкретні дні генеруються на льоту (TaskService.ExpandOccurrences).
public class RecurrenceRule
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Pattern { get; set; } = string.Empty; // Daily | Weekly | Monthly
    public string? DaysOfWeek { get; set; } // "1,3,5" (1=Пн..7=Нд), лише для Weekly
    public TimeOnly TimeOfDay { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    public List<RecurrenceException> Exceptions { get; set; } = new();
}
