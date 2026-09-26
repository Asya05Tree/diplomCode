namespace Server.Models;

// Код підтвердження email при реєстрації (coding-guide.md §4).
// Прив'язаний до Email, а не до UserId — код запитується ДО того, як акаунт створено.
public class EmailVerificationCode
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;

    public string Code { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }
}
