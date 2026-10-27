using Server.Data;
using Server.Models;

namespace Server.DataImport;

// Забезпечує наявність тегів продуктів (алергени/нутрієнти/зберігання) і повертає Id за ключем.
// Теги використовує рушій правил для фільтрації страв за хворобами (цукор, сіль, пурини, гостре)
// та алергіями (молочне, глютен, яйця, риба...).
public static class TagCatalog
{
    // Namespace, Key, українська назва, батьківський ключ (для ієрархії: dairy → lactose).
    private static readonly (string Ns, string Key, string Uk, string? Parent)[] Catalog =
    {
        ("allergen", "dairy",     "Молочне",  null),
        ("allergen", "lactose",   "Лактоза",  "dairy"),
        ("allergen", "gluten",    "Глютен",   null),
        ("allergen", "egg",       "Яйця",     null),
        ("allergen", "fish",      "Риба",     null),
        ("allergen", "nuts",      "Горіхи",   null),
        ("nutrient", "starch",    "Крохмаль", null),
        ("nutrient", "sugar",     "Цукор",    null),
        ("nutrient", "salt",      "Сіль",     null),
        ("nutrient", "purines",   "Пурини",   null),
        ("nutrient", "spicy",     "Гостре",   null),
        ("nutrient", "vegetable", "Овочі",    null),
        ("nutrient", "meat",      "М'ясо",    null),
        ("storage",  "canned",    "Консерви", null),
    };

    // Повертає словник key → Tag.Id, попередньо створивши відсутні теги (ідемпотентно).
    public static Dictionary<string, int> Ensure(AppDbContext db)
    {
        var byKey = db.Tags.ToDictionary(t => t.Key, t => t);

        // Спершу створюємо всі теги без батька, щоб потім проставити ParentId
        foreach (var (ns, key, uk, _) in Catalog)
        {
            if (!byKey.TryGetValue(key, out var tag))
            {
                tag = new Tag { Namespace = ns, Key = key, DisplayName = uk };
                db.Tags.Add(tag);
                byKey[key] = tag;
            }
            else { tag.Namespace = ns; tag.DisplayName = uk; }
        }
        db.SaveChanges();

        foreach (var (_, key, _, parent) in Catalog)
        {
            if (parent != null && byKey.TryGetValue(parent, out var p))
                byKey[key].ParentId = p.Id;
        }
        db.SaveChanges();

        return byKey.ToDictionary(kv => kv.Key, kv => kv.Value.Id);
    }
}
