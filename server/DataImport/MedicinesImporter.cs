using System.Globalization;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using Server.Data;
using Server.Models;

namespace Server.DataImport;

// Імпорт довідника ліків із Державного реєстру лікарських засобів (ДРЛЗ, data.gov.ua).
// CSV у кодуванні Windows-1251, роздільник ';'. Беремо ЛИШЕ: торгову назву, діючу речовину (МНН) і форму випуску.
// Фільтри: тільки безрецептурні ("без рецепта" в "Умовах відпуску") і тільки побутові форми.
// Дублікати (та сама назва+форма, що різняться лише дозуванням/виробником) згортаємо в одну картку.
// Інструкції/дозування/показання НЕ імпортуємо.
public static class MedicinesImporter
{
    // Перше слово поля "Форма випуску" → ключ MedicineForm. Інші форми (розчини, концентрати,
    // ліофілізати, настойки, трави...) свідомо відкидаємо — це не побутова домашня аптечка.
    private static readonly Dictionary<string, string> FormMap = new()
    {
        ["таблетки"] = "tablets", ["капсули"] = "capsules", ["сироп"] = "syrups", ["краплі"] = "drops",
        ["мазь"] = "ointments", ["гель"] = "ointments", ["крем"] = "ointments", ["лінімент"] = "ointments",
        ["емульгель"] = "ointments", ["паста"] = "ointments",
        ["спрей"] = "sprays", ["аерозоль"] = "sprays",
        ["супозиторії"] = "suppositories", ["песарії"] = "suppositories",
        ["порошок"] = "powders", ["гранули"] = "powders",
        ["льодяники"] = "lozenges", ["пастилки"] = "lozenges", ["драже"] = "lozenges",
    };

    public static void Run(AppDbContext db)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance); // для cp1251

        var path = Path.Combine(ImportPaths.SeedData, "reestr.csv");
        if (!File.Exists(path)) { Console.WriteLine($"  [warn] {path} not found — skip medicines"); return; }

        // Ідемпотентність (clear-then-insert системних довідкових рядків):
        // спершу прибираємо взаємодії й системні ліки/речовини, далі наповнюємо наново.
        db.SubstanceInteractions.RemoveRange(db.SubstanceInteractions);
        db.SaveChanges();
        db.Medicines.RemoveRange(db.Medicines.Where(m => m.IsSystem));
        db.SaveChanges();
        db.Substances.RemoveRange(db.Substances);
        db.SaveChanges();

        var formId = db.MedicineForms.ToDictionary(f => f.Key, f => f.Id);

        var substances = new Dictionary<string, Substance>(); // ключ: NameEn у нижньому регістрі
        var seen = new HashSet<string>();                     // (назва|форма) для згортання дублікатів
        int rowsOtcHousehold = 0, skippedRx = 0, skippedForm = 0;

        var toAdd = new List<Medicine>();

        using (var reader = new StreamReader(path, Encoding.GetEncoding(1251)))
        using (var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
               { Delimiter = ";", BadDataFound = null, MissingFieldFound = null, HasHeaderRecord = true }))
        {
            csv.Read(); csv.ReadHeader();
            while (csv.Read())
            {
                var name = (csv.GetField(1) ?? "").Trim();
                var inn = (csv.GetField(2) ?? "").Trim();
                var form = (csv.GetField(3) ?? "").Trim();
                var disp = (csv.GetField(4) ?? "").Trim();
                var atc = (csv.GetField(7) ?? "").Trim();
                if (name.Length == 0) continue;

                // Фільтр OTC: беремо лише коли в умовах відпуску згадано "без рецепта"
                if (!disp.ToLowerInvariant().Contains("без рецепта")) { skippedRx++; continue; }

                var formKey = MapForm(form);
                if (formKey == null) { skippedForm++; continue; }

                var dupKey = name.ToLowerInvariant() + "|" + formKey;
                if (!seen.Add(dupKey)) continue; // згортаємо дозування/виробників у одну картку
                rowsOtcHousehold++;

                // Діюча речовина: монопрепарат — заводимо Substance; комбінації/заглушки — SubstanceId=null
                Substance? sub = null;
                var cleaned = CleanInn(inn);
                if (cleaned.Length > 0 && IsSingleSubstance(cleaned))
                {
                    var key = cleaned.ToLowerInvariant();
                    if (!substances.TryGetValue(key, out sub))
                    {
                        sub = new Substance
                        {
                            NameEn = cleaned,
                            NameUk = SubstanceNameMap.DisplayUk(cleaned),
                            AtcCode = atc.Length > 0 ? atc : null,
                        };
                        substances[key] = sub;
                        db.Substances.Add(sub);
                    }
                    else if (sub.AtcCode == null && atc.Length > 0) sub.AtcCode = atc;
                }

                toAdd.Add(new Medicine
                {
                    NameUk = name,
                    NameEn = name, // ДРЛЗ не містить англійської торгової назви — зберігаємо реєстрову
                    Substance = sub,
                    FormId = formId[formKey],
                    IsOtc = true,
                    IsSystem = true,
                });
            }
        }

        db.SaveChanges(); // фіксуємо Substance.Id перед прив'язкою ліків
        db.Medicines.AddRange(toAdd);
        db.SaveChanges();

        Console.WriteLine($"  Medicines: {rowsOtcHousehold} cards (collapsed), Substances: {substances.Count}");
        Console.WriteLine($"  (skipped: {skippedRx} prescription-only, {skippedForm} non-household forms)");
    }

    private static string? MapForm(string form)
    {
        var first = form.ToLowerInvariant().Split(new[] { ' ', ',', ';' }, StringSplitOptions.RemoveEmptyEntries);
        return first.Length > 0 && FormMap.TryGetValue(first[0], out var k) ? k : null;
    }

    // Прибираємо хвостові виноски-зірочки (Validol*, Pelargonii radix**)
    private static string CleanInn(string inn) => inn.TrimEnd('*', ' ').Trim();

    // Відсіюємо заглушки й комбінації — для них немає однієї діючої речовини
    private static bool IsSingleSubstance(string inn)
    {
        var low = inn.ToLowerInvariant();
        if (low is "comb drug" or "mono") return false;
        if (low.Contains("combination")) return false;
        if (low.Contains("different salts")) return false;
        return true;
    }
}
