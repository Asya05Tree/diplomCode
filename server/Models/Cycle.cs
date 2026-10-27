namespace Server.Models;

// Модель даних модуля "Цикл" (planner-spec.md §3.7). Прогноз рахується по останніх записах.
// Перевірка запасів до дати використовує той самий StockItem/UserMedicine, що й їжа/аптечка.

public class CycleRecord
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
}

// Налаштування циклу (PK = UserId).
public class CycleSettings
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public bool ReduceLoadOnHeavyDays { get; set; }
}
