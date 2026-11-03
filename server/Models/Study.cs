namespace Server.Models;

// Модель даних модуля "Навчання". Розклад пар і консультації — НЕ окремі таблиці подій:
// вони живуть як RecurrenceRule + шаблонний TaskItem з ModuleCode="study" (генеруються на льоту
// в TaskService), а StudyScheduleEntry лише зберігає навчальні метадані й посилання на правило.
// Тут: предмети, завдання та сітка дзвінків. Налаштування, розклад і великі роботи — в окремих файлах.

// Предмет. Назва — один рядок (укр. або англ. — байдуже). Залежно від типу користувача й форми
// навчання в UI показуються різні поля: школяр має один набір "заняття" (використовується лише
// Lecture* — поділу лекція/семінар у школяра немає), студент — два: лекція (Lecture*) і семінар/пара
// (Seminar*). Кабінет — для очного, посилання — для дистанційного, обидва — для змішаного.
public class StudySubject
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Teacher { get; set; }
    public string? Color { get; set; }

    public string? LectureRoom { get; set; }
    public string? LectureLink { get; set; }
    public string? SeminarRoom { get; set; }
    public string? SeminarLink { get; set; }
}

// Завдання з предмета. Школяр: Type="homework". Студент: lab (дефолт) | exam | practical.
// Назви немає — спершу вид роботи (Type), далі обов'язковий опис (Description, до ~3 речень).
// Дедлайн обов'язковий (DeadlineKind); конкретна дата DueDate лише коли DeadlineKind="date".
// Оцінка (Grade) можлива лише коли виконано: школяр 0 або 1–12 ціле, студент 0–100 з сотими.
public class StudyAssignment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int? SubjectId { get; set; }
    public StudySubject? Subject { get; set; }
    public string Type { get; set; } = string.Empty;        // homework | lab | exam | practical
    public string Description { get; set; } = string.Empty;
    public string DeadlineKind { get; set; } = "date";      // semester | year | week | tomorrow | date
    public DateOnly? DueDate { get; set; }
    public bool IsDone { get; set; }
    public decimal? Grade { get; set; }
}

// Сітка дзвінків користувача: номер пари + межі часу. Дефолти (школяр 6, студент 3) засіває клієнт,
// межі (школяр 4–8, студент 2–5) теж контролює UI — тут лише зберігання.
public class BellPeriod
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public int Index { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}
