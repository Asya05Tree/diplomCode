using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;
using Server.RuleEngine;

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
        int? PriceAgeMonths, string Source, string? HealthWarning);

    public record SuggestionDto(int ProductId, string DisplayNameUk, string DisplayNameEn);
    public record PriceCoverageDto(int Known, int Total);
    public record ListDto(List<ShoppingItemDto> Items, List<SuggestionDto> Suggestions, PriceCoverageDto PriceCoverage);

    private const int SuggestionWindowDays = 90;

    // Реалістична верхня межа суми (грн), як у Фінансах: захист БД (decimal(18,2)) навіть в обхід UI.
    private const decimal MoneyMax = 1_000_000_000m;

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

        // Попередження за здоров'ям: чи не заборонений/небажаний продукт за жорсткими правилами
        // користувача (ті самі теги/обмеження, що й у «Їжі»). null — обмежень нема або продукт ок.
        var healthByProduct = await BuildHealthWarningsAsync(userId, items);

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

            string? health = x.ProductId is int hpid && healthByProduct.TryGetValue(hpid, out var hw) ? hw : null;

            return new ShoppingItemDto(x.Id, x.Section, x.Category, x.ProductId, x.MedicineId, x.CustomText,
                nameUk, nameEn, x.IsChecked, estimated, ageMonths, x.Source, health);
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

    // Попередження за здоров'ям для позицій-продуктів: evaluate теги продукту проти жорстких
    // обмежень користувача (Forbidden/Avoid) тим самим RuleEngine, що й «Їжа». Повертає productId →
    // "Forbidden" | "Avoid" | null. Якщо обмежень нема — порожній словник (жодних попереджень).
    private async Task<Dictionary<int, string?>> BuildHealthWarningsAsync(int userId, List<ShoppingItem> items)
    {
        var result = new Dictionary<int, string?>();

        var prefs = await _db.UserTagPreferences
            .Include(p => p.Tag)
            .Where(p => p.UserId == userId && (p.Relation == "Forbidden" || p.Relation == "Avoid"))
            .ToListAsync();
        if (prefs.Count == 0) return result;

        var productIds = items.Where(x => x.ProductId != null).Select(x => x.ProductId!.Value).Distinct().ToList();
        if (productIds.Count == 0) return result;

        var restrictions = prefs
            .Where(p => p.Tag != null)
            .Select(p => new RuleEvaluator.Restriction(p.TagId, p.Tag!.Key, p.Relation))
            .ToList();
        var parentById = (await _db.Tags.ToListAsync()).ToDictionary(t => t.Id, t => t.ParentId);

        var productTags = await _db.Products
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new { p.Id, TagIds = p.Tags.Where(t => t.Value != "No").Select(t => t.TagId).ToList() })
            .ToListAsync();

        foreach (var pt in productTags)
        {
            var expanded = TagMatcher.ExpandWithAncestors(pt.TagIds, parentById);
            var ev = RuleEvaluator.Evaluate(expanded, restrictions);
            result[pt.Id] = ev.Forbidden != null ? "Forbidden" : (ev.Avoid != null ? "Avoid" : null);
        }
        return result;
    }

    // source/sourceEntityId — за замовчуванням ручне додавання; інші модулі (напр. "Cycle")
    // можуть позначити походження позиції, щоб уникати дублів і впізнавати її.
    public async Task<int?> AddItemAsync(int userId, string section, string? category, string? text, int? productId, int? medicineId,
        string source = "Manual", int? sourceEntityId = null)
    {
        if (section is not ("Groceries" or "Pharmacy" or "Household" or "Cosmetics" or "Stationery" or "Pets" or "Other")) return null;
        // Має бути рівно одне джерело назви: продукт, ліки або довільний текст
        if (productId is null && medicineId is null && string.IsNullOrWhiteSpace(text)) return null;
        // Посилання мають існувати (і продукт — бути системним або власним): інакше вставка падала б
        // порушенням зовнішнього ключа у 500. Чужий приватний продукт теж не приймаємо (IDOR) — 400.
        if (productId is int pid && !await _db.Products.AnyAsync(p => p.Id == pid && (p.IsSystem || p.CreatedByUserId == userId)))
            throw new BadInputException("invalid_product");
        if (medicineId is int mid && !await _db.Medicines.AnyAsync(m => m.Id == mid))
            throw new BadInputException("invalid_medicine");

        // Дедуп: та сама позиція (продукт / ліки / однаковий текст), ще не відмічена, вже є у списку —
        // не плодимо дубль і повертаємо наявний Id. Інакше повторне «нема в запасі» в Їжі чи повторний
        // клік додавали б копії тієї самої позиції (ПЛАН P2-9). Відмічені (куплені) не рахуємо — їх
        // можна додати знову для наступного походу.
        var customText = string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        ShoppingItem? duplicate = null;
        if (productId is int dpid)
            duplicate = await _db.ShoppingItems.FirstOrDefaultAsync(x => x.UserId == userId && !x.IsChecked && x.ProductId == dpid);
        else if (medicineId is int dmid)
            duplicate = await _db.ShoppingItems.FirstOrDefaultAsync(x => x.UserId == userId && !x.IsChecked && x.MedicineId == dmid);
        else if (customText is not null)
            duplicate = await _db.ShoppingItems.FirstOrDefaultAsync(x =>
                x.UserId == userId && !x.IsChecked && x.ProductId == null && x.MedicineId == null && x.CustomText == customText);
        if (duplicate is not null) return duplicate.Id;

        Limits.Ensure(await _db.ShoppingItems.CountAsync(i => i.UserId == userId), Limits.ShoppingItems, "shopping_items");

        var item = new ShoppingItem
        {
            UserId = userId,
            Section = section,
            Category = category,
            ProductId = productId,
            MedicineId = medicineId,
            CustomText = customText,
            Source = source,
            SourceEntityId = sourceEntityId,
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
        // Ціна необовʼязкова, але якщо задана — має бути в межах розумного діапазону (не відʼємна й не
        // більша за межу): інакше був би відʼємний "Expense" (дохід під виглядом витрати) або 500 через
        // переповнення decimal(18,2). Відхиляємо на вході (→ 400), а не ламаємо БД.
        if (price is decimal p && (p < 0 || p > MoneyMax)) throw new BadInputException("invalid_price");

        var item = await _db.ShoppingItems
            .Include(x => x.Product).Include(x => x.Medicine)
            .FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (item is null) return false;

        // Відмітка — одноразова: якщо позицію вже відмічено, повторний виклик нічого не дублює (ні
        // запасів, ні ціни, ні витрати). Так ті самі гроші не потрапляють у витрати двічі.
        if (item.IsChecked) return true;

        var now = DateTime.Now;
        item.IsChecked = true;
        if (price.HasValue) item.EstimatedPrice = price;

        if (item.ProductId is int productId)
        {
            await ReplenishStockAsync(userId, productId);
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

    private async Task ReplenishStockAsync(int userId, int productId)
    {
        var stock = await _db.StockItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);
        if (stock is null) _db.StockItems.Add(new StockItem { UserId = userId, ProductId = productId, State = "Available" });
        else stock.State = "Available";
    }

    private async Task UpsertPriceAsync(int userId, int productId, decimal price, DateTime now)
    {
        var pp = await _db.UserProductPrices.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);
        if (pp is null) _db.UserProductPrices.Add(new UserProductPrice { UserId = userId, ProductId = productId, LastPrice = price, UpdatedAt = now });
        else { pp.LastPrice = price; pp.UpdatedAt = now; }
    }

    // Задача-нагадування про похід у магазин (spisok-pokupok.md): якщо вказано дату — задача на той
    // день (Planned), інакше без дати (Нерозподілені). Посилання на модуль списку, щоб із картки
    // задачі відкрити екран списку з чекбоксами.
    public async Task<int> PlanTripAsync(int userId, DateTime? date)
    {
        // Ідемпотентно: якщо вже є відкрита (не завершена) задача-похід у магазин — повертаємо її,
        // а не плодимо дублі при кожному повторному кліку (ПЛАН P2-9). Похід у магазин по суті один:
        // той самий список, та сама задача, доки її не завершили/видалили. Якщо передали дату —
        // просто оновлюємо день наявної задачі (переносимо похід), а не створюємо другу.
        var existing = await _db.Tasks.FirstOrDefaultAsync(t =>
            t.UserId == userId && t.SourceModule == "shopping" && t.RecurrenceRuleId == null && t.Status != "Done");
        if (existing is not null)
        {
            if (date is not null)
            {
                existing.StartDateTime = date;
                existing.Status = "Planned";
                await _db.SaveChangesAsync();
            }
            return existing.Id;
        }

        var task = await _taskService.CreateTaskAsync(
            userId, "Купити за списком", null, date, null, null,
            moduleCode: "shopping", sourceModule: "shopping", sourceEntityId: 0);
        return task.Id;
    }
}
