namespace Server.Models;

// Модуль "Робота". Профіль роботи (один рядок на користувача, PK=UserId) + окремі таблиці:
// типи змін, записи графіка, контакти, відсутності (відпустки/лікарняні), зустрічі, зобов'язання.
// Записи графіка й зустрічі створюють події в спільному календарі (ModuleCode="work") через
// TaskService — так робочі дні видно і в розділі "Робота", і в головному календарі без дублювання.

// Профіль роботи: показується зверху розділу (назва + посада + роботодавець) і задає тип оплати.
public class WorkSettings
{
    public int UserId { get; set; }
    public User? User { get; set; }

    public string JobName { get; set; } = "";       // назва роботи (заголовок зверху)
    public string? Position { get; set; }            // посада
    public string? Employer { get; set; }            // роботодавець
    public string PayType { get; set; } = "hourly";  // hourly | monthly | project
    public decimal? Rate { get; set; }               // ставка: грн/год, грн/міс або за проєкт
}

// Тип зміни — свій колір і довільний проміжок часу (не лише день/ніч). Аналог "предмета" в навчанні.
public class WorkShiftType
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Name { get; set; } = "";
    public string Color { get; set; } = "#b3e5fc"; // HEX, показується в календарі й легенді
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}

// Запис графіка: тип зміни + правило повторення (ModuleCode="work"), що породжує події календаря.
// Аналог StudyScheduleEntry: тут лише посилання на тип і правило; видалення запису видаляє й правило.
public class WorkShiftEntry
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public int ShiftTypeId { get; set; }
    public WorkShiftType? ShiftType { get; set; }

    public int RecurrenceRuleId { get; set; } // згенероване правило повторення (ModuleCode="work")
}

// Робочий контакт. Групується за GroupName і статусом; пошта, день народження й соцмережі — за бажанням.
public class WorkContact
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string GroupName { get; set; } = "";    // група (керівництво / команда / суміжні…)
    public string Status { get; set; } = "online"; // online | busy | offline | vacation
    public string FullName { get; set; } = "";      // ПІБ
    public string Phone { get; set; } = "";         // номер телефону
    public string? Email { get; set; }              // за бажанням
    public DateOnly? Birthday { get; set; }         // за бажанням
    public string? Socials { get; set; }            // за бажанням (вільний рядок, напр. "IG @x · TG @y")
}

// Відсутність: тип + дата початку й кінця (таблиця, як просив користувач). У календар не виноситься.
public class WorkLeave
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Type { get; set; } = "vacation"; // vacation | sick
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
}

// Зустріч: з ким, коли (дата+час), посилання або кабінет. Створює подію в календарі (ModuleCode="work").
public class WorkMeeting
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string WithWhom { get; set; } = "";  // з ким
    public DateTime When { get; set; }           // дата й час
    public string? Place { get; set; }           // посилання або кабінет
    public int? TaskId { get; set; }             // пов'язана подія календаря (логічне посилання)
}

// Робоче зобов'язання / пункт планування процесу: назва, опційний дедлайн, прапорець виконання.
public class WorkObligation
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Title { get; set; } = "";
    public string? Note { get; set; }
    public DateOnly? DueDate { get; set; }
    public bool IsDone { get; set; }
}
