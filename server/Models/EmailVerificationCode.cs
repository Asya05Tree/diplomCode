namespace Server.Models;

// Код підтвердження email при реєстрації (coding-guide.md §4). Тільки схема — відправка й перевірка коду прийде окремим кроком.
public class EmailVerificationCode
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Code { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
}
