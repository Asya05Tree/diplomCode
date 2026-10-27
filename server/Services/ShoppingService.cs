using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// planner-spec.md §3.8, spisok-pokupok.md. Список покупок: розділи "Продукти"/"Аптека"/"Інше",
// підказки "часто купуєте" (PurchaseHistory, вікно 90 днів), особисті ціни (UserProductPrice).
// Відмітка покупки одним рухом: закрити позицію + поповнити запас + оновити ціну + створити витрату.
// Задача-похід у магазин створюється через TaskService із посиланням на цей модуль (SourceModule).
public class ShoppingService
{
    private readonly AppDbContext _db;
    private readonly TaskService _taskService;

    public ShoppingService(AppDbContext db, TaskService taskService)
    {
        _db = db;
        _taskService = taskService;
    }

    public record ShoppingItemDto(
        int Id, string Section, string? Category, int? ProductId, int? MedicineId, string? CustomText,
        string DisplayNameUk, string DisplayNameEn, bool IsChecked, decimal? EstimatedPrice,
        int? PriceAgeMonths, string Source);

    public record SuggestionDto(int ProductId, string DisplayNameUk, string DisplayNameEn);
    public record PriceCoverageDto(int Known, int Total);
    public record ListDto(List<ShoppingItemDto> Items, List<SuggestionDto> Suggestions, PriceCoverageDto PriceCoverage);

    public record SplitEntryDto(int ItemId, string DisplayNameUk, string DisplayNameEn, decimal Price);
    public record ReceiptSplitDto(decimal Total, decimal KnownSum, decimal Remainder, decimal PerItem, List<SplitEntryDto> Split);

    private const int SuggestionWindowDays = 90;

    // Різниця в цілих місяцях між датою ціни й сьогодні (для примітки "N місяців тому").
    private static int MonthsSince(DateTime from)
    {
        var now = DateTime.Now;
        var months = (now.Year - from.Year) * 12 + now.Month - from.Month;
        if (now.Day < from.Day) months--;
        return Math.Max(0, months);
    }

    public async Task<ListDto> GetListAsync(int userId)
    {
        var items = await _db.ShoppingItems
            .Where(x => x.UserId == userId)
            .Include(x => x.Product)
            .Include(x => x.Medicine)
            .OrderBy(x => x.IsChecked).ThenBy(x => x.CreatedAt)
            .ToListAsync();

        var prices = await _db.UserProductPrices
            .Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.ProductId, x => x);

        var dtos = items.Select(x =>
        {
            var (nameUk, nameEn) = DisplayName(x);

            // Ціна позиції: власна оцінка позиції, інакше остання особиста ціна продукту (з її "віком").
            decimal? estimated = x.EstimatedPrice;
            int? ageMonths = null;
            if (estimated is null && x.ProductId is int pid && prices.TryGetValue(pid, out var pp))
            {
                estimated = pp.LastPrice;
                ageMonths = MonthsSince(pp.UpdatedAt);
            }

            return new ShoppingItemDto(x.Id, x.Section, x.Category, x.ProductId, x.MedicineId, x.CustomText,
                nameUk, nameEn, x.IsChecked, estimated, ageMonths, x.Source);
        }).ToList();

        // Покриття цінами рахуємо по ПОТОЧНОМУ списку (невідмічені позиції) — звідси режим фільтра докупівлі
        var current = dtos.Where(d => !d.IsChecked).ToList();
        var coverage = new PriceCoverageDto(current.Count(d => d.EstimatedPrice.HasValue), current.Count);

        var suggestions = await BuildSuggestionsAsync(userId, items);
        return new ListDto(dtos, suggestions, coverage);
    }

    private static (string Uk, string En) DisplayName(ShoppingItem x)
    {
        if (x.Product != null) return (x.Product.NameUk, x.Product.NameEn);
        if (x.Medicine != null) return (x.Medicine.NameUk, x.Medicine.NameEn);
        var text = x.CustomText ?? "";
        return (text, text);
    }

    // "Часто купуєте": продукти з історії за 90 днів, яких зараз нема в списку; першими — ті,
    // що купуються часто, але давно не купувалися (сорт: частота спадно, остання покупка зростно).
    private async Task<List<SuggestionDto>> BuildSuggestionsAsync(int userId, List<ShoppingItem> currentItems)
    {
        var since = DateTime.Now.AddDays(-SuggestionWindowDays);
        var inList = currentItems.Where(x => x.ProductId != null).Select(x => x.ProductId!.Value).ToHashSet();

        var history = await _db.PurchaseHistories
            .Where(h => h.UserId == userId && h.ProductId != null && h.PurchasedAt >= since)
            .Include(h => h.Product)
            .ToListAsync();

        return history
            .Where(h => !inList.Contains(h.ProductId!.Value))
            .GroupBy(h => h.ProductId!.Value)
            .Select(g => new
            {
                ProductId = g.Key,
                Count = g.Count(),
                LastAt = g.Max(h => h.PurchasedAt),
                Product = g.First().Product,
            })
            .OrderByDescending(x => x.Count).ThenBy(x => x.LastAt)
            .Take(10)
            .Where(x => x.Product != null)
            .Select(x => new SuggestionDto(x.ProductId, x.Product!.NameUk, x.Product.NameEn))
            .ToList();
    }

    public async Task<int?> AddItemAsync(int userId, string section, string? category, string? text, int? productId, int? medicineId)
    {
        if (section is not ("Groceries" or "Pharmacy" or "Other")) return null;
        // Має бути рівно одне джерело назви: продукт, ліки або довільний текст
        if (productId is null && medicineId is null && string.IsNullOrWhiteSpace(text)) return null;

        var item = new ShoppingItem
        {
            UserId = userId,
            Section = section,
            Category = category,
            ProductId = productId,
            MedicineId = medicineId,
            CustomText = string.IsNullOrWhiteSpace(text) ? null : text.Trim(),
            Source = "Manual",
        };
        _db.ShoppingItems.Add(item);
        await _db.SaveChangesAsync();
        return item.Id;
    }

    public async Task<bool> DeleteItemAsync(int userId, int id)
    {
        var item = await _db.ShoppingItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (item is null) return false;
        _db.ShoppingItems.Remove(item);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SetCategoryAsync(int userId, int id, string? category)
    {
        var item = await _db.ShoppingItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (item is null) return false;
        item.Category = category;
        await _db.SaveChangesAsync();
        return true;
    }

    // Відмітка покупки одним рухом (spisok-pokupok.md §2): закрити позицію + поповнити запас/аптечку
    // + оновити особисту ціну + створити витрату (ціна необовʼязкова).
    public async Task<bool> CheckItemAsync(int userId, int id, decimal? price)
    {
        var item = await _db.ShoppingItems
            .Include(x => x.Product).Include(x => x.Medicine)
            .FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (item is null) return false;

        var now = DateTime.Now;
        item.IsChecked = true;
        item.CheckedAt = now;
        if (price.HasValue) item.EstimatedPrice = price;

        if (item.ProductId is int productId)
        {
            await ReplenishStockAsync(userId, productId, now);
            if (price.HasValue) await UpsertPriceAsync(userId, productId, price.Value, now);
            _db.PurchaseHistories.Add(new PurchaseHistory { UserId = userId, ProductId = productId, PurchasedAt = now });
        }
        else if (item.MedicineId is int medicineId)
        {
            var med = await _db.UserMedicines.FirstOrDefaultAsync(x => x.UserId == userId && x.MedicineId == medicineId);
            if (med is null) _db.UserMedicines.Add(new UserMedicine { UserId = userId, MedicineId = medicineId, State = "Available" });
            else med.State = "Available";
        }
        else if (!string.IsNullOrWhiteSpace(item.CustomText))
        {
            _db.PurchaseHistories.Add(new PurchaseHistory { UserId = userId, CustomText = item.CustomText, PurchasedAt = now });
        }

        if (price.HasValue)
        {
            var (nameUk, _) = DisplayName(item);
            _db.FinanceTransactions.Add(new FinanceTransaction
            {
                UserId = userId,
                Amount = price.Value,
                Type = "Expense",
                Category = item.Category,
                Description = nameUk,
                OccurredAt = now,
            });
        }

        await _db.SaveChangesAsync();
        return true;
    }

    private async Task ReplenishStockAsync(int userId, int productId, DateTime now)
    {
        var stock = await _db.StockItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);
        if (stock is null) _db.StockItems.Add(new StockItem { UserId = userId, ProductId = productId, State = "Available", UpdatedAt = now });
        else { stock.State = "Available"; stock.UpdatedAt = now; }
    }

    private async Task UpsertPriceAsync(int userId, int productId, decimal price, DateTime now)
    {
        var pp = await _db.UserProductPrices.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);
        if (pp is null) _db.UserProductPrices.Add(new UserProductPrice { UserId = userId, ProductId = productId, LastPrice = price, UpdatedAt = now });
        else { pp.LastPrice = price; pp.UpdatedAt = now; }
    }

    // Альтернатива поцінним цінам (spisok-pokupok.md §2): одна сума чека. Відомі ціни віднімаємо,
    // залишок рівно розкладаємо на відмічені позиції без ціни, створюємо одну витрату на весь чек.
    public async Task<ReceiptSplitDto> ApplyReceiptTotalAsync(int userId, decimal total)
    {
        var now = DateTime.Now;
        var checkedItems = await _db.ShoppingItems
            .Where(x => x.UserId == userId && x.IsChecked)
            .Include(x => x.Product).Include(x => x.Medicine)
            .ToListAsync();

        var knownSum = checkedItems.Where(x => x.EstimatedPrice.HasValue).Sum(x => x.EstimatedPrice!.Value);
        var unknown = checkedItems.Where(x => !x.EstimatedPrice.HasValue).ToList();
        var remainder = Math.Max(0m, total - knownSum);
        var perItem = unknown.Count > 0 ? Math.Round(remainder / unknown.Count, 2) : 0m;

        var split = new List<SplitEntryDto>();
        foreach (var item in unknown)
        {
            item.EstimatedPrice = perItem;
            if (item.ProductId is int productId) await UpsertPriceAsync(userId, productId, perItem, now);
            var (nameUk, nameEn) = DisplayName(item);
            split.Add(new SplitEntryDto(item.Id, nameUk, nameEn, perItem));
        }

        _db.FinanceTransactions.Add(new FinanceTransaction
        {
            UserId = userId,
            Amount = total,
            Type = "Expense",
            Category = "shopping",
            Description = "Покупки за чеком",
            OccurredAt = now,
        });

        await _db.SaveChangesAsync();
        return new ReceiptSplitDto(total, knownSum, remainder, perItem, split);
    }

    // Задача-нагадування про похід у магазин (spisok-pokupok.md): без дати (Нерозподілені), із
    // посиланням на модуль списку, щоб із картки задачі відкрити екран списку з чекбоксами.
    public async Task<int> PlanTripAsync(int userId)
    {
        var task = await _taskService.CreateTaskAsync(
            userId, "Купити за списком", null, null, null, null,
            moduleCode: "shopping", sourceModule: "shopping", sourceEntityId: 0);
        return task.Id;
    }
}
