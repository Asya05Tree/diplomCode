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

    // Режим (формат організації праці), ст. 50–60 КЗпП та трудова практика:
    // standard — звичайний | flexible — гнучкий (ГРРЧ) | irregular — ненормований |
    // split — розділений робочий день | rotational — вахтовий метод | parttime — неповний час |
    // reduced — скорочена тривалість | project — проєктна/фріланс | oncall — чергування.
    public string Regime { get; set; } = "standard";
    // Місце роботи: onsite — в офісі/на об'єкті | remote — дистанційна | home — надомна.
    public string Workplace { get; set; } = "onsite";
    public decimal? NormHours { get; set; }          // норма годин на тиждень (неповний/скорочений/гнучкий)
    public bool FullRateRetained { get; set; }        // скорочений час зі збереженням повної ставки
    public int? ExtraVacationDays { get; set; }       // додаткова відпустка (ненормований робочий день)
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

    // Вид зміни: normal — звичайна | flexible — гнучке вікно (ГРРЧ, час у межах проміжку) |
    // split — розділений день (дві частини з перервою) | oncall — чергування (окрема тарифікація).
    public string Kind { get; set; } = "normal";
    public TimeOnly? StartTime2 { get; set; }        // друга частина (split): початок
    public TimeOnly? EndTime2 { get; set; }          // друга частина (split): кінець
    public decimal? OnCallMultiplier { get; set; }   // коефіцієнт тарифу для чергування (напр. 1.5)

    public bool IsActive { get; set; } = true;       // неактивний тип не потрапляє в календар змін і в вибір
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
    public string Status { get; set; } = "online"; // (застаріле поле, в UI не показується)
    public string FullName { get; set; } = "";      // ПІБ (складається на клієнті з прізвища/імені/по батькові)
    public string Phone { get; set; } = "";         // номер телефону
    public string? Email { get; set; }              // за бажанням
    public DateOnly? Birthday { get; set; }         // за бажанням (рік ігнорується — показуємо лише число й місяць)
    public string? Socials { get; set; }            // (застаріле поле; замість нього Telegram/Viber)
    public string? Telegram { get; set; }           // за бажанням
    public string? Viber { get; set; }              // за бажанням
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

// Зобов'язання: статичний перелік того, що людина робить на посаді (назва + опис). Без дедлайнів
// і статусу — це опис ролі, а не задачі. (Поля DueDate/IsDone лишилися з попередньої версії, але
// більше не використовуються в інтерфейсі; планування задач винесено у WorkProcessTask нижче.)
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

// Планування процесу: to-do з колонками (планую / роблю / зроблено) і опційним дедлайном. Дедлайн
// виноситься в спільний календар (ModuleCode="work") через TaskService. "Прострочено" — похідний стан
// (DueDate < сьогодні && Status != done), окремо не зберігається.
public class WorkProcessTask
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Title { get; set; } = "";
    public string? Note { get; set; }
    public string Status { get; set; } = "planned"; // planned | doing | done
    public DateOnly? DueDate { get; set; }
    public int? TaskId { get; set; }                 // пов'язана подія календаря (логічне посилання)
}
