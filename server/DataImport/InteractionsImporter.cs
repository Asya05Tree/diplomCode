using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Server.Data;
using Server.Models;

namespace Server.DataImport;

// Імпорт взаємодій ліків із DDInter 2.0 (CC BY-NC-SA 4.0): 8 CSV за ATC-категоріями (A,B,D,H,L,P,R,V).
// Колонки: DDInterID_A, Drug_A, DDInterID_B, Drug_B, Level (Major/Moderate/Minor). Механізму в вивантаженні немає.
// Зберігаємо ПАРУ лише якщо ОБИДВА препарати зіставилися з нашими діючими речовинами (інакше — сотні тисяч зайвих рядків).
// Назви DDInter(англ) ↔ Substance.NameEn(англ МНН із ДРЛЗ) матчимо за нормалізованою формою.
public static class InteractionsImporter
{
    private static readonly string[] Categories = { "A", "B", "D", "H", "L", "P", "R", "V" };

    public static void Run(AppDbContext db)
    {
        // Індекс наших речовин за нормалізованою англійською назвою
        var subs = db.Substances.ToList();
        var byNorm = new Dictionary<string, Substance>();
        foreach (var s in subs)
            byNorm[SubstanceNameMap.Normalize(s.NameEn)] = s;

        var pairSeen = new HashSet<(int, int)>();
        var toAdd = new List<SubstanceInteraction>();
        int filesRead = 0, matchedDrugs = 0;

        foreach (var cat in Categories)
        {
            var path = Path.Combine(ImportPaths.SeedData, $"ddinter_{cat}.csv");
            if (!File.Exists(path)) continue;
            filesRead++;

            using var reader = new StreamReader(path);
            using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
                { BadDataFound = null, MissingFieldFound = null });
            csv.Read(); csv.ReadHeader();
            while (csv.Read())
            {
                var idA = csv.GetField("DDInterID_A") ?? "";
                var idB = csv.GetField("DDInterID_B") ?? "";
                var nameA = csv.GetField("Drug_A") ?? "";
                var nameB = csv.GetField("Drug_B") ?? "";
                var level = (csv.GetField("Level") ?? "").Trim();

                if (!byNorm.TryGetValue(SubstanceNameMap.Normalize(nameA), out var sa)) continue;
                if (!byNorm.TryGetValue(SubstanceNameMap.Normalize(nameB), out var sb)) continue;
                if (sa.Id == sb.Id) continue;

                // Проставляємо DdinterId із кросволку, поки є збіг назв
                if (sa.DdinterId == null && idA.Length > 0) { sa.DdinterId = idA; matchedDrugs++; }
                if (sb.DdinterId == null && idB.Length > 0) { sb.DdinterId = idB; matchedDrugs++; }

                // Пара без напрямку: зберігаємо один раз (у пошуку перевіряємо A-B і B-A)
                var pair = sa.Id < sb.Id ? (sa.Id, sb.Id) : (sb.Id, sa.Id);
                if (!pairSeen.Add(pair)) continue;

                toAdd.Add(new SubstanceInteraction
                {
                    SubstanceAId = pair.Item1,
                    SubstanceBId = pair.Item2,
                    Level = level.Length > 0 ? level : "Unknown",
                    Source = "DDInter",
                });
            }
        }

        db.SaveChanges();                 // фіксуємо проставлені DdinterId
        db.SubstanceInteractions.AddRange(toAdd);
        db.SaveChanges();

        Console.WriteLine($"  Interactions: {toAdd.Count} pairs (from {filesRead} DDInter files)");
        Console.WriteLine($"  Substances tagged with DdinterId: {subs.Count(s => s.DdinterId != null)}");
    }
}
