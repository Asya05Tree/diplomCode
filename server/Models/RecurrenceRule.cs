namespace Server.Models;

// planner-spec.md §3.3. Повторювані задачі не розгортаються в БД — зберігається одне правило
// + винятки/ручні дати, конкретні дні генеруються на льоту (TaskService.GenerateBaseDates).
//
// Чотири типи (Type), поля кожного типу заповнюються лише для свого типу (решта null):
//   WeekCycle  — CycleWeeks (1-4), CycleAnchorDate (тільки якщо CycleWeeks>1), WeekDaysPattern
//                у форматі "0:1,3|1:4,5" (індекс тижня в циклі : ISO-дні, 1=Пн..7=Нд)
//   EveryNDays — IntervalDays
//   MonthDays  — MonthDayMode (Specific|Even|Odd|LastDay), MonthDays "5,15,25" лише для Specific
//   Manual     — дати в окремій таблиці ManualRecurrenceDate, тут додаткових полів немає
public class RecurrenceRule
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Type { get; set; } = string.Empty; // WeekCycle | EveryNDays | MonthDays | Manual

    public TimeOnly TimeOfDay { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    public int? CycleWeeks { get; set; }
    public DateOnly? CycleAnchorDate { get; set; }
    public string? WeekDaysPattern { get; set; }

    public int? IntervalDays { get; set; }

    public string? MonthDayMode { get; set; } // Specific | Even | Odd | LastDay
    public string? MonthDays { get; set; }

    public List<RecurrenceException> Exceptions { get; set; } = new();
    public List<ManualRecurrenceDate> ManualDates { get; set; } = new();
}
