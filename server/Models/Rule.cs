namespace Server.Models;

// planner-spec.md §3.2. Hard — звужує множину варіантів, Soft — впорядковує вагами. Логіка застосування прийде з RuleEngine пізніше.
public class Rule
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Strength { get; set; } = string.Empty; // Hard | Soft
    public int? Weight { get; set; }

    public int TagId { get; set; }
    public Tag? Tag { get; set; }

    public string Action { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty; // System | User | Onboarding
    public bool IsEnabled { get; set; } = true;
}
