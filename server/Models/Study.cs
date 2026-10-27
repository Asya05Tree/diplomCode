namespace Server.Models;

// Модель даних модуля "Навчання". Розклад пар — частина ядра планувальника: самі пари задаються
// через RecurrenceRule/TaskItem з ModuleCode="study" (цикли тижнів/винятки вже реалізовані),
// а тут зберігаються предмети, сітка дзвінків, завдання й шкала оцінок.

public class StudySubject
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string NameUk { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public string? Teacher { get; set; }
    public string? Room { get; set; }
    public string? Color { get; set; }
}

// Завдання з предмета (домашка, лабораторна, іспит тощо).
public class StudyAssignment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int? SubjectId { get; set; }
    public StudySubject? Subject { get; set; }
    public string Type { get; set; } = string.Empty; // homework | lab | exam | project | ...
    public string Title { get; set; } = string.Empty;
    public DateOnly? DueDate { get; set; }
    public bool IsDone { get; set; }
}

// Сітка дзвінків користувача: номер пари + межі часу.
public class BellPeriod
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int Index { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}

// Шкала оцінок: нижня межа відсотків -> підпис (напр. 90 -> "Відмінно"/"A").
public class GradeScaleEntry
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int MinPercent { get; set; }
    public string Label { get; set; } = string.Empty;
}
