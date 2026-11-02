using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// planner-spec.md §3.6. Фінанси: один баланс на користувача, ліміти за період (Week/Month),
// транзакції (вручну + автоматичні витрати зі списку покупок). Рахунок створюється лінуво при
// першому зверненні. Усе просте й ручне — жодної "аналітики", лише облік введеного.
public class FinanceService
{
    private readonly AppDbContext _db;

    public FinanceService(AppDbContext db)
    {
        _db = db;
    }

    public record LimitDto(string PeriodType, decimal Amount);
    public record TransactionDto(int Id, decimal Amount, string Type, string? Category, string? Description, DateTime OccurredAt, int? TaskId);
    public record CategoryNetDto(string Category, decimal Net);
    public record FinanceDto(decimal Balance, List<LimitDto> Limits, List<TransactionDto> Transactions, List<CategoryNetDto> CategoryNets);
    public record WeekBucketDto(int Week, decimal Amount);
    public record StatsDto(List<WeekBucketDto> Weeks, decimal Average);

    private const int RecentTransactions = 100;

    // Реалістичні межі сум (грн): 0…1 млрд, 2 знаки — захист БД навіть в обхід UI.
    private const decimal MoneyMax = 1_000_000_000m;
    private static decimal ClampMoney(decimal v) => Math.Round(Math.Clamp(v, 0m, MoneyMax), 2);

    public async Task<FinanceDto> GetAsync(int userId)
    {
        var account = await _db.FinanceAccounts.FindAsync(userId);
        if (account is null)
        {
            account = new FinanceAccount { UserId = userId, Balance = 0 };
            _db.FinanceAccounts.Add(account);
            await _db.SaveChangesAsync();
        }

        var limits = await _db.FinanceLimits
            .Where(x => x.UserId == userId)
            .Select(x => new LimitDto(x.PeriodType, x.Amount))
            .ToListAsync();

        var transactions = await _db.FinanceTransactions
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.OccurredAt).ThenByDescending(x => x.Id)
            .Take(RecentTransactions)
            .Select(x => new TransactionDto(x.Id, x.Amount, x.Type, x.Category, x.Description, x.OccurredAt, x.TaskId))
            .ToListAsync();

        // «Є зараз» по категоріях = дохід − витрата за ВСІМА транзакціями (не лише останніми 100).
        var all = await _db.FinanceTransactions
            .Where(x => x.UserId == userId && x.Category != null)
            .Select(x => new { x.Category, x.Type, x.Amount })
            .ToListAsync();
        var categoryNets = all
            .GroupBy(x => x.Category!)
            .Select(g => new CategoryNetDto(g.Key, g.Sum(t => t.Type == "Income" ? t.Amount : -t.Amount)))
            .ToList();

        return new FinanceDto(account.Balance, limits, transactions, categoryNets);
    }

    // Тижнева динаміка витрат за місяць: кошики днів 1–7 / 8–14 / 15–21 / 22–кінець + середнє.
    public async Task<StatsDto> GetStatsAsync(int userId, int year, int month)
    {
        if (month is < 1 or > 12) month = 1;
        var start = new DateTime(year, month, 1);
        var end = start.AddMonths(1);
        var tx = await _db.FinanceTransactions
            .Where(x => x.UserId == userId && x.Type == "Expense" && x.OccurredAt >= start && x.OccurredAt < end)
            .Select(x => new { x.OccurredAt, x.Amount })
            .ToListAsync();

        var buckets = new decimal[4];
        foreach (var t in tx)
        {
            var d = t.OccurredAt.Day;
            var idx = d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3;
            buckets[idx] += t.Amount;
        }
        var weeks = buckets.Select((a, i) => new WeekBucketDto(i + 1, a)).ToList();
        var average = Math.Round(buckets.Sum() / buckets.Length, 2);
        return new StatsDto(weeks, average);
    }

    public async Task SetBalanceAsync(int userId, decimal balance)
    {
        var account = await _db.FinanceAccounts.FindAsync(userId);
        if (account is null)
        {
            account = new FinanceAccount { UserId = userId };
            _db.FinanceAccounts.Add(account);
        }
        account.Balance = ClampMoney(balance);
        account.UpdatedAt = DateTime.Now;
        await _db.SaveChangesAsync();
    }

    public async Task<bool> SetLimitAsync(int userId, string periodType, decimal amount)
    {
        if (periodType is not ("Week" or "Month")) return false;
        var limit = await _db.FinanceLimits.FirstOrDefaultAsync(x => x.UserId == userId && x.PeriodType == periodType);
        if (limit is null)
        {
            limit = new FinanceLimit { UserId = userId, PeriodType = periodType };
            _db.FinanceLimits.Add(limit);
        }
        limit.Amount = amount;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int?> AddTransactionAsync(int userId, decimal amount, string type, string? category, string? description, DateTime? occurredAt)
    {
        if (type is not ("Income" or "Expense")) return null;
        amount = ClampMoney(amount);
        if (amount <= 0) return null; // нульові/відʼємні операції не додаємо
        var tx = new FinanceTransaction
        {
            UserId = userId,
            Amount = amount,
            Type = type,
            Category = category,
            Description = description,
            OccurredAt = occurredAt ?? DateTime.Now,
        };
        _db.FinanceTransactions.Add(tx);
        await _db.SaveChangesAsync();
        return tx.Id;
    }

    public async Task<bool> DeleteTransactionAsync(int userId, int id)
    {
        var tx = await _db.FinanceTransactions.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (tx is null) return false;
        _db.FinanceTransactions.Remove(tx);
        await _db.SaveChangesAsync();
        return true;
    }
}
