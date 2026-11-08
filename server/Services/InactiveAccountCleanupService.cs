using Microsoft.EntityFrameworkCore;
using Server.Data;

namespace Server.Services;

// Фонова служба: раз на добу (1) попереджає листом користувачів, чий акаунт скоро видалять за
// неактивність, і (2) видаляє акаунти, неактивні понад рік. Попередження йде за ~30 днів до видалення
// (ст.8/12 ЗУ №2297-VI — суб'єкт має бути поінформований перед безповоротним видаленням чутливих даних).
// LastActiveAt при реєстрації = даті реєстрації, тож критерій працює й для тих, хто жодного разу не заходив.
public class InactiveAccountCleanupService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private static readonly TimeSpan InactivityLimit = TimeSpan.FromDays(365);
    private static readonly TimeSpan WarnBefore = TimeSpan.FromDays(30); // за скільки днів до видалення попереджати

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<InactiveAccountCleanupService> _logger;

    public InactiveAccountCleanupService(IServiceScopeFactory scopeFactory, ILogger<InactiveAccountCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Помилка під час очищення неактивних акаунтів");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var account = scope.ServiceProvider.GetRequiredService<AccountService>();
        var email = scope.ServiceProvider.GetRequiredService<EmailService>();

        var now = DateTime.UtcNow;
        var deleteCutoff = now - InactivityLimit;
        var warnCutoff = now - (InactivityLimit - WarnBefore); // неактивні понад (рік - 30 днів)

        // (1) Попередити тих, хто вже у «вікні попередження», але ще не підлягає видаленню і кому ще
        // не слали попередження після їхньої останньої активності (DeletionWarnedAt < LastActiveAt —
        // якщо користувач повертався після попередження, попередимо знову при новій неактивності).
        var toWarn = await db.Users
            .Where(u => u.LastActiveAt < warnCutoff && u.LastActiveAt >= deleteCutoff
                && (u.DeletionWarnedAt == null || u.DeletionWarnedAt < u.LastActiveAt))
            .ToListAsync(ct);
        foreach (var u in toWarn)
        {
            var daysLeft = Math.Max(1, (int)(u.LastActiveAt + InactivityLimit - now).TotalDays);
            await email.SendAccountDeletionWarningAsync(u.Email, u.Nickname, daysLeft);
            u.DeletionWarnedAt = now;
            _logger.LogInformation("Попереджено про видалення акаунт #{UserId} (лишилось ~{Days} дн.)", u.Id, daysLeft);
        }
        if (toWarn.Count > 0) await db.SaveChangesAsync(ct);

        // (2) Видалити тих, хто неактивний понад рік (вони вже отримали попередження на етапі (1)).
        var staleIds = await db.Users
            .Where(u => u.LastActiveAt < deleteCutoff)
            .Select(u => u.Id)
            .ToListAsync(ct);
        foreach (var id in staleIds)
        {
            await account.DeleteAccountAsync(id);
            _logger.LogInformation("Видалено неактивний акаунт #{UserId} (неактивний понад рік)", id);
        }
    }
}
