namespace Server.Models;

public class User
{
    public int Id { get; set; }
    public string Nickname { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsEmailConfirmed { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;       // дата реєстрації
    // Останній раз, коли користувач був активний (оновлюється не частіше ніж раз на добу). За цим
    // полем автоматично видаляються акаунти, неактивні понад рік (InactiveAccountCleanupService).
    public DateTime LastActiveAt { get; set; } = DateTime.UtcNow;

    public UserProfile? Profile { get; set; }
    public List<UserModule> Modules { get; set; } = new();
}
