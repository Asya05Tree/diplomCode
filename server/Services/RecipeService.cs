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

        var products = await _db.Products.Include(p => p.Tags).ToListAsync();
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
        }).ToList();

        var restrictionDtos = prefs
            .Where(p => p.Tag != null)
            .Select(p => new RestrictionDto(p.Tag!.Key, p.Relation, p.Tag!.DisplayName))
            .ToList();

        return new OverviewDto(productDtos, recipeDtos, stock.Select(s => new StockDto(s.ProductId, s.State)).ToList(),
            selected, cooked, restrictionDtos);
    }

    // ---- Запаси (StockItem) ----------------------------------------------------

    public async Task<bool> SetStockStateAsync(int userId, int productId, string state)
    {
        if (state is not ("Available" or "RunningLow" or "OutOfStock")) return false;
        var exists = await _db.Products.AnyAsync(p => p.Id == productId);
        if (!exists) return false;

        var item = await _db.StockItems.FirstOrDefaultAsync(x => x.UserId == userId && x.ProductId == productId);
        if (item is null)
        {
            item = new StockItem { UserId = userId, ProductId = productId };
            _db.StockItems.Add(item);
        }
        item.State = state;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public Task<bool> AddStockAsync(int userId, int productId) => SetStockStateAsync(userId, productId, "Available");

    // ---- Обрані страви (SelectedDish) ------------------------------------------

    public async Task<bool> ToggleSelectedAsync(int userId, int recipeId, bool selected)
    {
        var exists = await _db.Recipes.AnyAsync(r => r.Id == recipeId);
        if (!exists) return false;

        var current = await _db.SelectedDishes.FirstOrDefaultAsync(x => x.UserId == userId && x.RecipeId == recipeId);
        if (selected && current is null)
            _db.SelectedDishes.Add(new SelectedDish { UserId = userId, RecipeId = recipeId });
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
