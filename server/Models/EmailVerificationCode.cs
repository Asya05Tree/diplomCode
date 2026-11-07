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

    // Кількість невдалих спроб вводу цього коду; після 5 код «спалюється» (IsUsed=true). Інакше
    // 6-значний код брутфорситься перебором (ПЛАН P2-6).
    public int Attempts { get; set; }

    // Коли код створено — для кулдауну send-code (не частіше одного коду на email за 60 с), щоб не
    // можна було нескінченно запитувати нові коди й так обходити ліміт спроб (ПЛАН P2-6).
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
