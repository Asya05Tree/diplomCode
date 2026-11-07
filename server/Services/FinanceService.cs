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
    public record FinanceDto(decimal Balance, List<LimitDto> Limits, List<TransactionDto> Transactions, List<CategoryNetDto> CategoryNets, List<string> HiddenCategories);
    public record WeekBucketDto(int Week, decimal Amount);
    // Три набори тижневих кошиків за місяць: витрати, доходи й баланс (дохід−витрата) зі знаком.
    public record StatsDto(List<WeekBucketDto> ExpenseWeeks, List<WeekBucketDto> IncomeWeeks, List<WeekBucketDto> NetWeeks, decimal ExpenseAverage, decimal IncomeAverage);

    private const int RecentTransactions = 100;

    // Реалістичні межі сум (грн): 0…1 млрд, 2 знаки — захист БД навіть в обхід UI.
    private const decimal MoneyMax = 1_000_000_000m;
    private static decimal ClampMoney(decimal v) => Math.Round(Math.Clamp(v, 0m, MoneyMax), 2);

    // Allowlist категорій — дзеркало client/src/utils/financeCategories.js. Category транзакції — або
    // null (без категорії), або один із цих ключів; будь-що інше → 400 invalid_category (ПЛАН P2-5).
    // Без перевірки прямий виклик API створював би «сироту»: net рахується в «Є зараз», але рядок
    // невидимий у вкладці Категорії (UI рендерить лише відомі ключі), а сирий ключ показувався як назва.
    private static readonly HashSet<string> CategoryKeys = new()
    {
        "food", "housing", "utilities", "communication", "transport", "car", "health", "household",
        "clothing", "entertainment", "dining", "hobbies", "beauty", "sport", "subscriptions", "shopping",
        "pocket", "travel", "car_repair", "taxes", "gifts", "home_big", "education", "medical",
        "renovation", "kids", "pets", "loans", "savings", "investments", "insurance", "charity", "family_help",
    };

    // Розумне вікно дати операції: не раніше 2000 р. і не більш ніж на добу в майбутнє (запас на часові
    // пояси). Клієнт міг слати будь-який OccurredAt і бек-/ф'ючер-дейтити історію та статистику (ПЛАН P2-5).
    private static readonly DateTime MinOccurredAt = new(2000, 1, 1);

    // Порожня категорія → null (дозволено); відома → повертаємо ключ; невідома → 400.
    private static string? NormalizeCategory(string? category)
    {
        if (string.IsNullOrWhiteSpace(category)) return null;
        var key = category.Trim();
        if (!CategoryKeys.Contains(key)) throw new BadInputException("invalid_category");
        return key;
    }

    public async Task<FinanceDto> GetAsync(int userId)
    {
        // GET не повинен писати в БД (ПЛАН P2-3): якщо рахунку ще нема — баланс 0, без створення рядка.
        // Рахунок створиться лінуво при першому SetBalanceAsync (PUT).
        var account = await _db.FinanceAccounts.FindAsync(userId);
        var balance = account?.Balance ?? 0m;

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

        var hidden = await _db.FinanceHiddenCategories
            .Where(x => x.UserId == userId)
            .Select(x => x.CategoryKey)
            .ToListAsync();

        return new FinanceDto(balance, limits, transactions, categoryNets, hidden);
    }

    // Тижнева динаміка за місяць: кошики днів 1–7 / 8–14 / 15–21 / 22–кінець — окремо витрати,
    // доходи й баланс (дохід−витрата). Транзакції прихованих категорій не враховуються.
    public async Task<StatsDto> GetStatsAsync(int userId, int year, int month)
    {
        // Діапазон року: 2000…поточний+1. Поза ним new DateTime(year,…) кидав ArgumentOutOfRange → 500
        // (DoS через ?year=0/-1/10000). Тепер — 400 invalid_year (ПЛАН P2-5).
        if (year < 2000 || year > DateTime.Now.Year + 1) throw new BadInputException("invalid_year");
        if (month is < 1 or > 12) month = 1;
        var start = new DateTime(year, month, 1);
        var end = start.AddMonths(1);

        var hidden = (await _db.FinanceHiddenCategories
            .Where(x => x.UserId == userId)
            .Select(x => x.CategoryKey)
            .ToListAsync()).ToHashSet();

        var tx = await _db.FinanceTransactions
            .Where(x => x.UserId == userId && x.OccurredAt >= start && x.OccurredAt < end)
            .Select(x => new { x.OccurredAt, x.Amount, x.Type, x.Category })
            .ToListAsync();

        var expense = new decimal[4];
        var income = new decimal[4];
        foreach (var t in tx)
        {
            if (t.Category != null && hidden.Contains(t.Category)) continue; // сховані категорії не рахуємо
            var d = t.OccurredAt.Day;
            var idx = d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3;
            if (t.Type == "Income") income[idx] += t.Amount;
            else expense[idx] += t.Amount;
        }

        var expenseWeeks = expense.Select((a, i) => new WeekBucketDto(i + 1, a)).ToList();
        var incomeWeeks = income.Select((a, i) => new WeekBucketDto(i + 1, a)).ToList();
        var netWeeks = expense.Select((_, i) => new WeekBucketDto(i + 1, income[i] - expense[i])).ToList();
        var expenseAverage = Math.Round(expense.Sum() / expense.Length, 2);
        var incomeAverage = Math.Round(income.Sum() / income.Length, 2);
        return new StatsDto(expenseWeeks, incomeWeeks, netWeeks, expenseAverage, incomeAverage);
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
        limit.Amount = ClampMoney(amount); // ліміт — теж гроші: без від'ємних/абсурдних значень (ПЛАН P2-5)
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int?> AddTransactionAsync(int userId, decimal amount, string type, string? category, string? description, DateTime? occurredAt)
    {
        if (type is not ("Income" or "Expense")) return null;
        amount = ClampMoney(amount);
        if (amount <= 0) return null; // нульові/відʼємні операції не додаємо
        category = NormalizeCategory(category);
        var when = occurredAt ?? DateTime.Now;
        if (when < MinOccurredAt || when > DateTime.Now.AddDays(1)) throw new BadInputException("invalid_date");
        Limits.Ensure(await _db.FinanceTransactions.CountAsync(t => t.UserId == userId),
            Limits.FinanceTransactions, "finance_transactions");
        var tx = new FinanceTransaction
        {
            UserId = userId,
            Amount = amount,
            Type = type,
            Category = category,
            Description = description,
            OccurredAt = when,
        };
        _db.FinanceTransactions.Add(tx);
        await UnhideIfNeededAsync(userId, category); // внесення у категорію робить її активною
        await _db.SaveChangesAsync();
        return tx.Id;
    }

    // Редагування операції в історії: сума/тип/категорія/опис. «Є зараз» по категоріях і статистика
    // деривуються з транзакцій, тож перераховуються самі при наступному GET. Перенесення у сховану
    // категорію автоматично робить її активною (все, що вноситься в історію, — активне).
    public async Task<bool> UpdateTransactionAsync(int userId, int id, decimal amount, string type, string? category, string? description)
    {
        if (type is not ("Income" or "Expense")) return false;
        var tx = await _db.FinanceTransactions.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (tx is null) return false;
        amount = ClampMoney(amount);
        if (amount <= 0) return false;
        category = NormalizeCategory(category);

        tx.Amount = amount;
        tx.Type = type;
        tx.Category = category;
        tx.Description = description;
        await UnhideIfNeededAsync(userId, category);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteTransactionAsync(int userId, int id)
    {
        var tx = await _db.FinanceTransactions.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (tx is null) return false;
        _db.FinanceTransactions.Remove(tx);
        await _db.SaveChangesAsync();
        return true;
    }

    // Приховати/повернути категорію. Приховану не можна поповнювати (стереже UI), її транзакції не
    // враховуються у статистиці, але самі дані лишаються.
    public async Task<bool> SetCategoryHiddenAsync(int userId, string categoryKey, bool hidden)
    {
        if (string.IsNullOrWhiteSpace(categoryKey)) return false;
        var key = categoryKey.Trim();
        if (!CategoryKeys.Contains(key)) return false; // ховати можна лише відому категорію (ПЛАН P2-5)
        var existing = await _db.FinanceHiddenCategories
            .FirstOrDefaultAsync(x => x.UserId == userId && x.CategoryKey == key);
        if (hidden)
        {
            if (existing is null)
                _db.FinanceHiddenCategories.Add(new FinanceHiddenCategory { UserId = userId, CategoryKey = key });
        }
        else if (existing != null)
        {
            _db.FinanceHiddenCategories.Remove(existing);
        }
        await _db.SaveChangesAsync();
        return true;
    }

    // Якщо категорія була схована — прибираємо її зі списку прихованих (без окремого SaveChanges;
    // викликається перед спільним збереженням).
    private async Task UnhideIfNeededAsync(int userId, string? category)
    {
        if (string.IsNullOrWhiteSpace(category)) return;
        var hidden = await _db.FinanceHiddenCategories
            .FirstOrDefaultAsync(x => x.UserId == userId && x.CategoryKey == category);
        if (hidden != null) _db.FinanceHiddenCategories.Remove(hidden);
    }
}
