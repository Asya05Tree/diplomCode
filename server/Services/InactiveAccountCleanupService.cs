using Microsoft.EntityFrameworkCore;
using Server.Data;

namespace Server.Services;

// Фонова служба: раз на добу видаляє акаунти, неактивні понад рік (LastActiveAt старіше за рік).
// LastActiveAt при реєстрації дорівнює даті реєстрації, тож критерій працює й для тих, хто
// зареєструвався й жодного разу не заходив. Видалення — через AccountService (повне, з усіма даними).
public class InactiveAccountCleanupService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);
    private static readonly TimeSpan InactivityLimit = TimeSpan.FromDays(365);

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

        var cutoff = DateTime.UtcNow - InactivityLimit;
        var staleIds = await db.Users
            .Where(u => u.LastActiveAt < cutoff)
            .Select(u => u.Id)
            .ToListAsync(ct);

        foreach (var id in staleIds)
        {
            await account.DeleteAccountAsync(id);
            _logger.LogInformation("Видалено неактивний акаунт #{UserId} (неактивний понад рік)", id);
        }
    }
}
