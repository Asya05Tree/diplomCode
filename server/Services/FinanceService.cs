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
    public record FinanceDto(decimal Balance, List<LimitDto> Limits, List<TransactionDto> Transactions);

    private const int RecentTransactions = 100;

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

        return new FinanceDto(account.Balance, limits, transactions);
    }

    public async Task SetBalanceAsync(int userId, decimal balance)
    {
        var account = await _db.FinanceAccounts.FindAsync(userId);
        if (account is null)
        {
            account = new FinanceAccount { UserId = userId };
            _db.FinanceAccounts.Add(account);
        }
        account.Balance = balance;
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
