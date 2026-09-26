namespace Server.Models;

// planner-spec.md §3.2. Один механізм для алергій (Forbidden) і смаків (Avoid/Prefer з вагою).
public class UserTagPreference
{
    public int UserId { get; set; }
    public User? User { get; set; }

    public int TagId { get; set; }
    public Tag? Tag { get; set; }

    public string Relation { get; set; } = string.Empty; // Forbidden | Avoid | Prefer
    public int? Weight { get; set; } // 1-10, тільки для Avoid і Prefer
}
