using System.Text.Json;
using Server.Data;
using Server.Models;

namespace Server.DataImport;

// Міграція 6 системних рецептів із псевдо-БД клієнта (client/src/pseudo-db/recipes.json)
// у Recipe/RecipeIngredient/RecipeStep (двомовно, з емодзі та кроками). Інгредієнти зв'язуються
// з продуктами за рядковим id (той самий ключ, що й в ingredients.json).
public static class RecipesImporter
{
    private sealed class RecipeDto
    {
        public string Id { get; set; } = "";
        public string NameUk { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Emoji { get; set; } = "";
        public int CookTimeMinutes { get; set; }
        public List<IngredientRef> Ingredients { get; set; } = new();
        public List<StepDto> Steps { get; set; } = new();
    }
    private sealed class IngredientRef { public string ProductId { get; set; } = ""; public string AmountUk { get; set; } = ""; public string AmountEn { get; set; } = ""; }
    private sealed class StepDto { public string Uk { get; set; } = ""; public string En { get; set; } = ""; }

    public static void Run(AppDbContext db, Dictionary<string, int> productIdByKey)
    {
        var path = Path.Combine(ImportPaths.ClientPseudoDb, "recipes.json");
        var recipes = JsonSerializer.Deserialize<List<RecipeDto>>(File.ReadAllText(path),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        var existing = db.Recipes.Where(r => r.IsSystem).ToDictionary(r => r.NameEn, r => r);

        foreach (var r in recipes)
        {
            if (!existing.TryGetValue(r.NameEn, out var recipe))
            {
                recipe = new Recipe { NameEn = r.NameEn, IsSystem = true };
                db.Recipes.Add(recipe);
                existing[r.NameEn] = recipe;
            }
            recipe.NameUk = r.NameUk;
            recipe.Emoji = r.Emoji;
            recipe.CookTimeMinutes = r.CookTimeMinutes;
            db.SaveChanges();

            // Повністю перезаписуємо склад і кроки (ідемпотентно)
            db.RecipeIngredients.RemoveRange(db.RecipeIngredients.Where(x => x.RecipeId == recipe.Id));
            db.RecipeSteps.RemoveRange(db.RecipeSteps.Where(x => x.RecipeId == recipe.Id));
            db.SaveChanges();

            foreach (var ing in r.Ingredients)
            {
                if (!productIdByKey.TryGetValue(ing.ProductId, out var pid))
                {
                    Console.WriteLine($"  [warn] recipe '{r.Id}': unknown product '{ing.ProductId}', skipped");
                    continue;
                }
                db.RecipeIngredients.Add(new RecipeIngredient
                {
                    RecipeId = recipe.Id, ProductId = pid, AmountUk = ing.AmountUk, AmountEn = ing.AmountEn
                });
            }
            for (int i = 0; i < r.Steps.Count; i++)
                db.RecipeSteps.Add(new RecipeStep
                {
                    RecipeId = recipe.Id, StepNumber = i + 1, TextUk = r.Steps[i].Uk, TextEn = r.Steps[i].En
                });
            db.SaveChanges();
        }
        Console.WriteLine($"  Recipes: {recipes.Count}");
    }
}
