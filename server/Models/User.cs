namespace Server.Models;

public class User
{
    public int Id { get; set; }
    public string Nickname { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsEmailConfirmed { get; set; }

    // Версія токена для відкликання JWT. Кладеться в claim "tver" при видачі; при "Вийти"/видаленні
    // акаунта інкрементується, і всі раніше видані токени (зі старою версією) перестають проходити
    // валідацію. Простіше за чорний список/refresh-токени й достатньо для диплома (ПЛАН P2-1).
    public int TokenVersion { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;       // дата реєстрації
    // Останній раз, коли користувач був активний (оновлюється не частіше ніж раз на добу). За цим
    // полем автоматично видаляються акаунти, неактивні понад рік (InactiveAccountCleanupService).
    public DateTime LastActiveAt { get; set; } = DateTime.UtcNow;

    // Згода на обробку персональних даних (ЗУ №2297-VI ст.2,6,11): дата прийняття Політики
    // конфіденційності при реєстрації. Обов'язкова — без неї реєстрація не відбувається.
    public DateTime? PolicyAcceptedAt { get; set; }
    // Коли надіслано попередження про майбутнє автовидалення неактивного акаунта (ст.8/12 — суб'єкт
    // має бути поінформований перед безповоротним видаленням чутливих даних).
    public DateTime? DeletionWarnedAt { get; set; }

    // Платна фіча "швидке додавання": скільки безкоштовних використань уже витрачено і чи
    // куплено повний доступ назавжди. Ліміт безкоштовних — у конфізі (Billing:FreeLimit).
    public int QuickAddUsedCount { get; set; }
    public bool QuickAddUnlocked { get; set; }

    public UserProfile? Profile { get; set; }
    public List<UserModule> Modules { get; set; } = new();
}
