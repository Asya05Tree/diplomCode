using Server.Data;
using Server.Models;

namespace Server.DataImport;

// Сідає системний довідник доз щеплень (VaccineDose) — Календар профілактичних щеплень в Україні.
// Одиниця — ДОЗА: інфекція + порядковий номер + правило (за віком / за інтервалом у місяцях).
// Умовні гілки схем ("для дітей, які потребують дозу в першу добу") НЕ вносимо — беремо основну схему.
// Дані орієнтовні (довідкові); перед захистом звірити віки з опублікованим наказом. Ідемпотентно:
// upsert за (InfectionKey, DoseNumber).
//
// УВАГА (точність): усталена схема наказу МОЗ № 595. Редакція № 396 (чинна з 01.01.2026) могла
// змінити деталі, найімовірніше — вік/схему ВПЛ. Джерело зберігається в кожному рядку для показу в UI.
public static class VaccinesImporter
{
    private const string Src = "Наказ МОЗ № 595 від 16.09.2011 (у ред. наказу № 396 від 05.03.2025)";

    // Місяці для вікових позначок, щоб таблиця читалась: 6 р = 72, 14 р = 168, 16 р = 192, 11 р = 132.
    // (Key, Uk, En, DoseNumber, RuleType, ValueMonths)
    private static readonly (string Key, string Uk, string En, int Dose, string Rule, int Months)[] Doses =
    {
        // Туберкульоз (БЦЖ) — новонароджені (3–5 доба)
        ("tb", "Туберкульоз", "Tuberculosis", 1, "Age", 0),

        // Гепатит В — основна схема 0–2–6 міс
        ("hepb", "Гепатит В", "Hepatitis B", 1, "Age", 0),
        ("hepb", "Гепатит В", "Hepatitis B", 2, "Age", 2),
        ("hepb", "Гепатит В", "Hepatitis B", 3, "Age", 6),

        // Дифтерія (АКДП → АДП → АДП-М) + доросла ревакцинація кожні 10 років
        ("diphtheria", "Дифтерія", "Diphtheria", 1, "Age", 2),
        ("diphtheria", "Дифтерія", "Diphtheria", 2, "Age", 4),
        ("diphtheria", "Дифтерія", "Diphtheria", 3, "Age", 6),
        ("diphtheria", "Дифтерія", "Diphtheria", 4, "Age", 18),
        ("diphtheria", "Дифтерія", "Diphtheria", 5, "Age", 72),
        ("diphtheria", "Дифтерія", "Diphtheria", 6, "Age", 192),
        ("diphtheria", "Дифтерія", "Diphtheria", 7, "Interval", 120),

        // Правець (разом із дифтерією) + доросла ревакцинація кожні 10 років
        ("tetanus", "Правець", "Tetanus", 1, "Age", 2),
        ("tetanus", "Правець", "Tetanus", 2, "Age", 4),
        ("tetanus", "Правець", "Tetanus", 3, "Age", 6),
        ("tetanus", "Правець", "Tetanus", 4, "Age", 18),
        ("tetanus", "Правець", "Tetanus", 5, "Age", 72),
        ("tetanus", "Правець", "Tetanus", 6, "Age", 192),
        ("tetanus", "Правець", "Tetanus", 7, "Interval", 120),

        // Кашлюк (АКДП) — первинна серія + ревакцинація у 18 міс
        ("pertussis", "Кашлюк", "Pertussis", 1, "Age", 2),
        ("pertussis", "Кашлюк", "Pertussis", 2, "Age", 4),
        ("pertussis", "Кашлюк", "Pertussis", 3, "Age", 6),
        ("pertussis", "Кашлюк", "Pertussis", 4, "Age", 18),

        // Поліомієліт (ІПВ/ОПВ) — серія + ревакцинації 18 міс, 6 р, 14 р
        ("polio", "Поліомієліт", "Poliomyelitis", 1, "Age", 2),
        ("polio", "Поліомієліт", "Poliomyelitis", 2, "Age", 4),
        ("polio", "Поліомієліт", "Poliomyelitis", 3, "Age", 6),
        ("polio", "Поліомієліт", "Poliomyelitis", 4, "Age", 18),
        ("polio", "Поліомієліт", "Poliomyelitis", 5, "Age", 72),
        ("polio", "Поліомієліт", "Poliomyelitis", 6, "Age", 168),

        // Хіб-інфекція (Haemophilus influenzae type b)
        ("hib", "Хіб-інфекція", "Hib infection", 1, "Age", 2),
        ("hib", "Хіб-інфекція", "Hib infection", 2, "Age", 4),
        ("hib", "Хіб-інфекція", "Hib infection", 3, "Age", 12),

        // Кір (КПК) — 12 міс і 6 років
        ("measles", "Кір", "Measles", 1, "Age", 12),
        ("measles", "Кір", "Measles", 2, "Age", 72),

        // Епідемічний паротит (КПК)
        ("mumps", "Епідемічний паротит", "Mumps", 1, "Age", 12),
        ("mumps", "Епідемічний паротит", "Mumps", 2, "Age", 72),

        // Краснуха (КПК)
        ("rubella", "Краснуха", "Rubella", 1, "Age", 12),
        ("rubella", "Краснуха", "Rubella", 2, "Age", 72),

        // Вірус папіломи людини (ВПЛ) — дівчата, 2 дози (друга — за інтервалом 6 міс)
        ("hpv", "Вірус папіломи людини (ВПЛ)", "Human papillomavirus (HPV)", 1, "Age", 132),
        ("hpv", "Вірус папіломи людини (ВПЛ)", "Human papillomavirus (HPV)", 2, "Interval", 6),
    };

    public static void Run(AppDbContext db)
    {
        var order = 0;
        foreach (var (key, uk, en, dose, rule, months) in Doses)
        {
            order += 10;
            var existing = db.VaccineDoses.FirstOrDefault(v => v.InfectionKey == key && v.DoseNumber == dose);
            if (existing == null)
            {
                db.VaccineDoses.Add(new VaccineDose
                {
                    InfectionKey = key, InfectionUk = uk, InfectionEn = en,
                    DoseNumber = dose, RuleType = rule, RuleValueMonths = months,
                    SortOrder = order, Source = Src,
                });
            }
            else
            {
                existing.InfectionUk = uk; existing.InfectionEn = en;
                existing.RuleType = rule; existing.RuleValueMonths = months;
                existing.SortOrder = order; existing.Source = Src;
            }
        }
        db.SaveChanges();
    }
}
