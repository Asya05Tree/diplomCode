using Server.Data;
using Server.Models;

namespace Server.DataImport;

// Сідає довідник форм випуску (MedicineForm) — це "категорії" ліків у UI.
// Пластир/бинт/термометр тощо мають Key="medical-device", щоб не плодити категорію з одного елемента.
public static class FormsImporter
{
    // Key має збігатися з ключами, які повертає MedicinesImporter при мапінгу форми з ДРЛЗ.
    private static readonly (string Key, string Uk, string En)[] Forms =
    {
        ("tablets",        "Таблетки",        "Tablets"),
        ("capsules",       "Капсули",         "Capsules"),
        ("syrups",         "Сиропи",          "Syrups"),
        ("drops",          "Краплі",          "Drops"),
        ("ointments",      "Мазі та гелі",    "Ointments & gels"),
        ("sprays",         "Спреї",           "Sprays"),
        ("suppositories",  "Супозиторії",     "Suppositories"),
        ("powders",        "Порошки",         "Powders"),
        ("lozenges",       "Льодяники",       "Lozenges"),
        ("medical-device", "Медичні вироби",  "Medical devices"),
    };

    public static void Run(AppDbContext db)
    {
        foreach (var (key, uk, en) in Forms)
        {
            // Ідемпотентність: оновлюємо наявний запис за ключем, інакше додаємо
            var existing = db.MedicineForms.FirstOrDefault(f => f.Key == key);
            if (existing == null)
                db.MedicineForms.Add(new MedicineForm { Key = key, NameUk = uk, NameEn = en });
            else { existing.NameUk = uk; existing.NameEn = en; }
        }
        db.SaveChanges();
    }
}
