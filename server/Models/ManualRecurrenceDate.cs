namespace Server.Models;

// planner-spec.md §3.3. Тип правила "вручну" — дати, додані кліком по місячній сітці,
// не описуються формулою, зберігаються прямим переліком.
public class ManualRecurrenceDate
{
    public int Id { get; set; }
    public int RecurrenceRuleId { get; set; }
    public RecurrenceRule? RecurrenceRule { get; set; }

    public DateOnly Date { get; set; }
}
