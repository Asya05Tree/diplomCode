namespace Server.Models;

// Модель даних модуля "Фінанси" (planner-spec.md §3.6). Усе вводиться вручну.
// Єдина автоматична ланка — сума покупки продуктів потрапляє у витрати.

// Один рахунок на користувача (PK = UserId).
public class FinanceAccount
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public decimal Balance { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// Ліміт витрат за період (PK = {UserId, PeriodType}).
public class FinanceLimit
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public string PeriodType { get; set; } = string.Empty; // Week | Month
    public decimal Amount { get; set; }
}

// Транзакція. TaskId — необов'язкове посилання на задачу-похід у магазин (зв'язок зі списком покупок).
public class FinanceTransaction
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public decimal Amount { get; set; }
    public string Type { get; set; } = "Expense"; // Income | Expense
    public string? Category { get; set; }
    public string? Description { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public int? TaskId { get; set; }
}
