using System.Globalization;
using System.Text.Json;
using CsvHelper;
using CsvHelper.Configuration;
using Server.Data;
using Server.Models;

namespace Server.DataImport;

// Імпорт продуктів (інгредієнтів). Набір задають рецепти (DataImport/ingredients.json — ті самі ~25 продуктів,
// що й у псевдо-БД клієнта), а походження/категорію беремо з USDA FoodData Central (food.csv + food_category.csv):
// за англійською назвою знаходимо FdcId і FdcCategory. Нутрієнтні таблиці НЕ імпортуємо — лише назву й категорію.
// Теги: куровані з ingredients.json + автоматично похідні від FDC-категорії (Dairy→lactose, зернові→gluten тощо).
public static class IngredientsImporter
{
    private sealed class IngredientDto
    {
        public string Id { get; set; } = "";
        public string NameUk { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string StorageGroup { get; set; } = "";
        public List<string> Tags { get; set; } = new();
        public string? FdcQuery { get; set; }
    }

    // FDC-категорія → додаткові теги (демонстрація автопохідних алергенів/нутрієнтів)
    private static readonly Dictionary<string, string[]> CategoryTags = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Dairy and Egg Products"] = new[] { "dairy", "lactose" },
        ["Cereal Grains and Pasta"] = new[] { "gluten" },
        ["Baked Products"] = new[] { "gluten" },
        ["Finfish and Shellfish Products"] = new[] { "fish" },
        ["Nut and Seed Products"] = new[] { "nuts" },
        ["Pork Products"] = new[] { "meat" },
        ["Poultry Products"] = new[] { "meat" },
        ["Beef Products"] = new[] { "meat" },
        ["Lamb, Veal, and Game Products"] = new[] { "meat" },
        ["Vegetables and Vegetable Products"] = new[] { "vegetable" },
    };

    // Повертає jsonId → Product.Id, щоб RecipesImporter зв'язав інгредієнти рецептів із продуктами.
    public static Dictionary<string, int> Run(AppDbContext db)
    {
        var tagId = TagCatalog.Ensure(db);

        var jsonPath = Path.Combine(ImportPaths.DataImportDir, "ingredients.json");
        var items = JsonSerializer.Deserialize<List<IngredientDto>>(File.ReadAllText(jsonPath),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        var fdc = LoadFdcFoods(); // може бути порожнім, якщо датасети відсутні
        Console.WriteLine($"  FDC foods loaded: {fdc.Count}");

        // Системні продукти шукаємо за англійською назвою — для ідемпотентності повторних запусків
        var existing = db.Products.Where(p => p.IsSystem).ToDictionary(p => p.NameEn, p => p);
        var result = new Dictionary<string, int>();
        int matched = 0, manual = 0;

        foreach (var it in items)
        {
            if (!existing.TryGetValue(it.NameEn, out var product))
            {
                product = new Product { NameEn = it.NameEn, IsSystem = true };
                db.Products.Add(product);
                existing[it.NameEn] = product;
            }
            product.NameUk = it.NameUk;
            product.StorageGroup = it.StorageGroup;

            // Зіставлення з FDC: беремо найкоротший опис, що містить пошуковий рядок (найзагальніший запис)
            var hit = it.FdcQuery != null ? ResolveFdc(fdc, it.FdcQuery) : null;
            if (hit != null) { product.FdcId = hit.Value.FdcId; product.FdcCategory = hit.Value.Category; matched++; }
            else { product.FdcId = null; product.FdcCategory = null; manual++; }

            db.SaveChanges(); // потрібен Product.Id для ProductTag

            // Теги: куровані + похідні від FDC-категорії; перезаписуємо повністю (ідемпотентно)
            var keys = new HashSet<string>(it.Tags);
            if (hit != null && CategoryTags.TryGetValue(hit.Value.Category, out var extra))
                foreach (var k in extra) keys.Add(k);

            var old = db.ProductTags.Where(pt => pt.ProductId == product.Id).ToList();
            if (old.Count > 0) db.ProductTags.RemoveRange(old);
            foreach (var k in keys)
                if (tagId.TryGetValue(k, out var tid))
                    db.ProductTags.Add(new ProductTag { ProductId = product.Id, TagId = tid, Value = "Yes" });
            db.SaveChanges();

            result[it.Id] = product.Id;
        }

        Console.WriteLine($"  Products: {items.Count} (FDC-matched: {matched}, manual/no-match: {manual})");
        return result;
    }

    private static (int FdcId, string Category)? ResolveFdc(
        List<(int FdcId, string Desc, string Category)> fdc, string query)
    {
        var q = query.ToLowerInvariant();
        (int, string)? best = null;
        int bestLen = int.MaxValue;
        foreach (var f in fdc)
        {
            if (!f.Desc.ToLowerInvariant().Contains(q)) continue;
            if (f.Desc.Length < bestLen) { bestLen = f.Desc.Length; best = (f.FdcId, f.Category); }
        }
        return best;
    }

    private static List<(int FdcId, string Desc, string Category)> LoadFdcFoods()
    {
        var list = new List<(int, string, string)>();
        if (!Directory.Exists(ImportPaths.SeedData)) return list;

        // Категорії з усіх розпакованих датасетів (foundation + sr_legacy)
        var cats = new Dictionary<string, string>();
        foreach (var cf in Directory.GetFiles(ImportPaths.SeedData, "food_category.csv", SearchOption.AllDirectories))
            foreach (var r in ReadCsv(cf))
                cats[r["id"]] = r["description"];

        foreach (var ff in Directory.GetFiles(ImportPaths.SeedData, "food.csv", SearchOption.AllDirectories))
            foreach (var r in ReadCsv(ff))
            {
                if (!int.TryParse(r["fdc_id"], out var id)) continue;
                cats.TryGetValue(r.GetValueOrDefault("food_category_id", ""), out var cat);
                list.Add((id, r.GetValueOrDefault("description", ""), cat ?? ""));
            }
        return list;
    }

    // Стандартний CSV із комою (FDC) — читаємо через CsvHelper у словники за заголовком
    private static IEnumerable<Dictionary<string, string>> ReadCsv(string path)
    {
        using var reader = new StreamReader(path);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            BadDataFound = null,
            MissingFieldFound = null,
        });
        csv.Read(); csv.ReadHeader();
        var headers = csv.HeaderRecord!;
        while (csv.Read())
        {
            var dict = new Dictionary<string, string>();
            foreach (var h in headers) dict[h] = csv.GetField(h) ?? "";
            yield return dict;
        }
    }
}
