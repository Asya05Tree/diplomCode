using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;
using Server.RuleEngine;

namespace Server.Services;

// planner-spec.md §3.4. Модуль "Їжа": довідники продуктів/рецептів (системні) + користувацький
// стан (запаси StockItem, обрані страви SelectedDish, LastCookedAt). Один збірний запит /overview
// віддає все для сторінки одразу, разом із порахованим статусом здоровʼя (RuleEngine), щоб клієнт
// не переобчислював заборони/небажаності самостійно. Усі користувацькі вибірки — через userId.
public class RecipeService
{
    private readonly AppDbContext _db;

    public RecipeService(AppDbContext db)
    {
        _db = db;
    }

    public record HealthDto(string? Forbidden, string? Avoid);

    public record ProductDto(
        int Id, string NameUk, string NameEn, string StorageGroup,
        List<string> Tags, decimal? PersonalPrice, HealthDto Health);

    public record IngredientDto(int ProductId, string AmountUk, string AmountEn);
    public record StepDto(int StepNumber, string TextUk, string TextEn);

    public record RecipeDto(
        int Id, string NameUk, string NameEn, string Emoji, int CookTimeMinutes,
        List<IngredientDto> Ingredients, List<StepDto> Steps,
        HealthDto Health, List<int> MissingProductIds);

    public record StockDto(int ProductId, string State);
    public record RestrictionDto(string TagKey, string Relation, string DisplayName);

    public record OverviewDto(
        List<ProductDto> Products, List<RecipeDto> Recipes, List<StockDto> Stock,
        List<int> Selected, Dictionary<int, DateTime> LastCooked, List<RestrictionDto> Restrictions);

    public async Task<OverviewDto> GetOverviewAsync(int userId)
    {
        // Довідник тегів: карта ParentId для розгортання предків і ключі/назви для відповіді
        var tags = await _db.Tags.ToListAsync();
        var parentById = tags.ToDictionary(t => t.Id, t => t.ParentId);
        var keyById = tags.ToDictionary(t => t.Id, t => t.Key);

        // Обмеження користувача на їжу (жорсткі/мʼякі) — вони ж є списком правил для RuleEngine
        var prefs = await _db.UserTagPreferences
            .Include(p => p.Tag)
            .Where(p => p.UserId == userId && (p.Relation == "Forbidden" || p.Relation == "Avoid"))
            .ToListAsync();
        var restrictions = prefs
            .Where(p => p.Tag != null)
            .Select(p => new RuleEvaluator.Restriction(p.TagId, p.Tag!.Key, p.Relation))
            .ToList();

        // Лише системні продукти + власні продукти користувача: чужі приватні продукти не мають
        // потрапляти у відповідь (інакше чуже ім'я продукту «протікало» б у чужий огляд — IDOR).
        var products = await _db.Products
            .Where(p => p.IsSystem || p.CreatedByUserId == userId)
            .Include(p => p.Tags).ToListAsync();
        var prices = await _db.UserProductPrices
            .Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.ProductId, x => x.LastPrice);
        var stock = await _db.StockItems.Where(x => x.UserId == userId).ToListAsync();
        var stockByProduct = stock.ToDictionary(x => x.ProductId, x => x.State);
        var selected = await _db.SelectedDishes.Where(x => x.UserId == userId).Select(x => x.RecipeId).Distinct().ToListAsync();
        var cooked = await _db.UserRecipeStates
            .Where(x => x.UserId == userId && x.LastCookedAt != null)
            .ToDictionaryAsync(x => x.RecipeId, x => x.LastCookedAt!.Value);

        // Теги продукту, що РАХУЮТЬСЯ як присутні: Value != "No" (алергенний "Unknown" — як присутній, §3.4)
        List<int> PresentTagIds(Product p) => p.Tags.Where(t => t.Value != "No").Select(t => t.TagId).ToList();

        HealthDto Health(IEnumerable<int> tagIds)
        {
            var expanded = TagMatcher.ExpandWithAncestors(tagIds, parentById);
            var r = RuleEvaluator.Evaluate(expanded, restrictions);
            return new HealthDto(r.Forbidden, r.Avoid);
        }

        var productDtos = products.Select(p => new ProductDto(
            p.Id, p.NameUk, p.NameEn, p.StorageGroup,
            PresentTagIds(p).Select(id => keyById[id]).ToList(),
            prices.TryGetValue(p.Id, out var price) ? price : null,
            Health(PresentTagIds(p)))).ToList();

        // "Є" або "закінчується" = продукт у наявності; "немає"/відсутній = треба докупити (§3.4)
        bool IsPresent(int productId) =>
            stockByProduct.TryGetValue(productId, out var s) && (s == "Available" || s == "RunningLow");

        var recipes = await _db.Recipes.Include(r => r.Ingredients).Include(r => r.Steps).ToListAsync();
        var productTagIds = products.ToDictionary(p => p.Id, PresentTagIds);

        var recipeDtos = recipes.Select(r =>
        {
            var aggregatedTags = r.Ingredients
                .SelectMany(i => productTagIds.TryGetValue(i.ProductId, out var t) ? t : new List<int>())
                .ToList();
            var missing = r.Ingredients
                .Where(i => !IsPresent(i.ProductId))
                .Select(i => i.ProductId)
                .Distinct()
                .ToList();
            return new RecipeDto(
                r.Id, r.NameUk, r.NameEn, r.Emoji, r.CookTimeMinutes,
                r.Ingredients.Select(i => new IngredientDto(i.ProductId, i.AmountUk, i.AmountEn)).ToList(),
                r.Steps.OrderBy(s => s.StepNumber).Select(s => new StepDto(s.StepNumber, s.TextUk, s.TextEn)).ToList(),
                Health(aggregatedTags), missing);
        })
        // Заборонені правилами здоровʼя страви сервер НЕ повертає зовсім (spec §4.6, §2.3) — заборона
        // стережеться тут, а не лише ховається в UI, тож «одна точка перевірки» справді на сервері.
        .Where(dto => dto.Health.Forbidden == null)
        .ToList();

        var restrictionDtos = prefs
            .Where(p => p.Tag != null)
            .Select(p => new RestrictionDto(p.Tag!.Key, p.Relation, p.Tag!.DisplayName))
            .ToList();

        return new OverviewDto(productDtos, recipeDtos, stock.Select(s => new StockDto(s.ProductId, s.State)).ToList(),
            selected, cooked, restrictionDtos);
    }

    // ---- Запаси (StockItem) ----------------------------------------------------

    // Повертає false, якщо продукт недоступний (не існує або чужий приватний) → контролер віддає 404.
    // Невалідний стан — окрема помилка (400), щоб клієнт розрізняв «погане значення» і «нема продукту».
    public async Task<bool> SetStockStateAsync(int userId, int productId, string state)
    {
        if (state is not ("Available" or "RunningLow" or "OutOfStock")) throw new BadInputException("invalid_stock");
        // Дозволено лише системні продукти або власні продукти користувача: чужий приватний productId
        // не можна ні редагувати, ні «підтягнути» у свій огляд (IDOR на запаси).
        var allowed = await _db.Products.AnyAsync(p => p.Id == productId && (p.IsSystem || p.CreatedByUserId == userId));
        if (!allowed) return false;

        var item = await _db.StockItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);
        if (item is null)
        {
            Limits.Ensure(await _db.StockItems.CountAsync(x => x.UserId == userId), Limits.StockItems, "stock_items");
            item = new StockItem { UserId = userId, ProductId = productId };
            _db.StockItems.Add(item);
        }
        item.State = state;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public Task<bool> AddStockAsync(int userId, int productId) => SetStockStateAsync(userId, productId, "Available");

    // Результат додавання запасу за назвою: який продукт, чи створено новий, чи вже був у наявності.
    public record AddStockByNameResult(int ProductId, string NameUk, string NameEn, bool Created, bool AlreadyInStock);

    // Додати продукт у запаси за вільним текстом (швидке додавання). Знаходимо наявний продукт
    // (системний або створений цим користувачем) за точною назвою без урахування регістру; якщо
    // немає — створюємо користувацький продукт. Тоді ставимо StockItem="Available", повертаючи,
    // чи він уже був у наявності (перевірка на наявність зі слів користувача).
    public async Task<AddStockByNameResult?> AddStockByNameAsync(int userId, string name)
    {
        var clean = (name ?? string.Empty).Trim();
        if (clean.Length == 0) return null;
        var lower = clean.ToLower();

        var product = await _db.Products
            .Where(p => p.IsSystem || p.CreatedByUserId == userId)
            .FirstOrDefaultAsync(p => p.NameUk.ToLower() == lower || p.NameEn.ToLower() == lower);

        var created = false;
        if (product is null)
        {
            Limits.Ensure(await _db.Products.CountAsync(p => p.CreatedByUserId == userId), Limits.FoodProducts, "food_products");
            product = new Product { NameUk = clean, NameEn = clean, StorageGroup = string.Empty, IsSystem = false, CreatedByUserId = userId };
            _db.Products.Add(product);
            await _db.SaveChangesAsync(); // отримати Id
            created = true;
        }

        var item = await _db.StockItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == product.Id);
        var alreadyInStock = item is not null && item.State != "OutOfStock";
        if (item is null)
        {
            Limits.Ensure(await _db.StockItems.CountAsync(x => x.UserId == userId), Limits.StockItems, "stock_items");
            item = new StockItem { UserId = userId, ProductId = product.Id };
            _db.StockItems.Add(item);
        }
        item.State = "Available";
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new AddStockByNameResult(product.Id, product.NameUk, product.NameEn, created, alreadyInStock);
    }

    // Чи є рецепт ЗАБОРОНЕНИМ для користувача за його жорсткими правилами (RuleEngine) — та сама
    // логіка, що й у /overview, але для однієї страви. Потрібно, щоб заборону стерегти на сервері
    // (не можна обрати/приготувати заборонену страву), а не лише ховати її в UI (spec §2.3/§4.6).
    private async Task<bool> IsRecipeForbiddenAsync(int userId, int recipeId)
    {
        var prefs = await _db.UserTagPreferences
            .Include(p => p.Tag)
            .Where(p => p.UserId == userId && (p.Relation == "Forbidden" || p.Relation == "Avoid"))
            .ToListAsync();
        if (prefs.Count == 0) return false; // немає обмежень — нема що забороняти

        var recipe = await _db.Recipes.Include(r => r.Ingredients).FirstOrDefaultAsync(r => r.Id == recipeId);
        if (recipe is null) return false;

        var restrictions = prefs
            .Where(p => p.Tag != null)
            .Select(p => new RuleEvaluator.Restriction(p.TagId, p.Tag!.Key, p.Relation))
            .ToList();

        var parentById = (await _db.Tags.ToListAsync()).ToDictionary(t => t.Id, t => t.ParentId);
        var productIds = recipe.Ingredients.Select(i => i.ProductId).Distinct().ToList();
        var aggregatedTags = await _db.Products
            .Where(p => productIds.Contains(p.Id))
            .Include(p => p.Tags)
            .SelectMany(p => p.Tags.Where(t => t.Value != "No").Select(t => t.TagId))
            .ToListAsync();

        var expanded = TagMatcher.ExpandWithAncestors(aggregatedTags, parentById);
        return RuleEvaluator.Evaluate(expanded, restrictions).Forbidden != null;
    }

    // ---- Обрані страви (SelectedDish) ------------------------------------------

    public async Task<bool> ToggleSelectedAsync(int userId, int recipeId, bool selected)
    {
        var exists = await _db.Recipes.AnyAsync(r => r.Id == recipeId);
        if (!exists) return false;

        // Обрати заборонену страву не можна (стережемо на сервері). Зняти вибір — завжди можна.
        if (selected && await IsRecipeForbiddenAsync(userId, recipeId))
            throw new BadInputException("recipe_forbidden");

        var current = await _db.SelectedDishes.FirstOrDefaultAsync(x => x.UserId == userId && x.RecipeId == recipeId);
        if (selected && current is null)
        {
            Limits.Ensure(await _db.SelectedDishes.CountAsync(x => x.UserId == userId), Limits.SelectedDishes, "selected_dishes");
            _db.SelectedDishes.Add(new SelectedDish { UserId = userId, RecipeId = recipeId });
        }
        else if (!selected && current is not null)
            _db.SelectedDishes.Remove(current);
        await _db.SaveChangesAsync();
        return true;
    }

    // ---- LastCookedAt (UserRecipeState) ----------------------------------------

    public async Task<bool> MarkCookedAsync(int userId, int recipeId)
    {
        var exists = await _db.Recipes.AnyAsync(r => r.Id == recipeId);
        if (!exists) return false;

        // Позначити приготованою заборонену страву не можна (та сама серверна точка перевірки).
        if (await IsRecipeForbiddenAsync(userId, recipeId))
            throw new BadInputException("recipe_forbidden");

        var state = await _db.UserRecipeStates.FirstOrDefaultAsync(x => x.UserId == userId && x.RecipeId == recipeId);
        if (state is null)
        {
            state = new UserRecipeState { UserId = userId, RecipeId = recipeId };
            _db.UserRecipeStates.Add(state);
        }
        state.LastCookedAt = DateTime.Now;
        await _db.SaveChangesAsync();
        return true;
    }
}
