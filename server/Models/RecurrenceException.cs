namespace Server.Models;

// planner-spec.md §3.3. Cancelled — пропустити входження цієї дати, Moved — перенести на NewDateTime.
public class RecurrenceException
{
    public int Id { get; set; }
    public int RecurrenceRuleId { get; set; }
    public RecurrenceRule? RecurrenceRule { get; set; }

    public DateOnly Date { get; set; }
    public string ExceptionType { get; set; } = string.Empty; // Cancelled | Moved
    public DateTime? NewDateTime { get; set; }
}
