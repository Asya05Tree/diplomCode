namespace Server.Models;

// Один запис розкладу (пара) або консультації/факультативу. Самі події календаря генерує
// пов'язане RecurrenceRule (ModuleCode="study") — тому запис одночасно видно і в розкладі,
// і в спільному календарі (Planner), без дублювання логіки. Тут лише навчальні метадані
// плюс посилання на правило (RecurrenceRuleId); видалення запису видаляє і правило.
public class StudyScheduleEntry
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string EntryKind { get; set; } = "lesson"; // lesson | consultation | elective
    public int? SubjectId { get; set; }                // відомий предмет (для консультації — опційно)
    public StudySubject? Subject { get; set; }
    public string? Name { get; set; }                  // назва консультації/факультативу (пара бере назву предмета)
    public string? SessionKind { get; set; }           // lecture | seminar (пари студента); null для школяра/консультацій
    public int? PairNumber { get; set; }               // номер пари → час береться з BellPeriod

    // Для консультацій/факультативів — власна форма навчання й кабінет/посилання (пара бере їх із предмета)
    public string? Form { get; set; }                  // distance | regular | mixed
    public string? Room { get; set; }
    public string? Link { get; set; }

    public int RecurrenceRuleId { get; set; }          // згенероване правило повторення (ModuleCode="study")
}
