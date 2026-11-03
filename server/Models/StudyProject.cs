namespace Server.Models;

// Велика робота студента: диплом / курсова (курсач) / практика. Поля однакові (назва, куратор,
// опційний дедлайн, крокова таблиця), відрізняє лише Kind. Відсоток виконання рахується з кроків
// (виконані / усі) і не зберігається.
public class StudyProject
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Kind { get; set; } = "diploma"; // diploma | coursework | practice
    public string Name { get; set; } = string.Empty;
    public string? Curator { get; set; }

    public string? DeadlineKind { get; set; }      // null (без дедлайну) | semester | year | week | tomorrow | date
    public DateOnly? DueDate { get; set; }

    public List<StudyProjectStep> Steps { get; set; } = new();
}

// Крок великої роботи: назва процесу, дати початку/кінця, чи виконано.
public class StudyProjectStep
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public StudyProject? Project { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public bool IsDone { get; set; }
}
