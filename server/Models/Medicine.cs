namespace Server.Models;

// Модель даних модуля "Здоров'я"/аптечка (planner-spec.md §3.5). Довідник ліків імпортується з ДРЛЗ,
// взаємодії — з DDInter 2.0. Конфлікти зберігаються на діючій речовині, а не на торговій назві.

// Діюча речовина (МНН). DdinterId/AtcCode — для зіставлення назв ДРЛЗ(укр) ↔ DDInter(англ).
public class Substance
{
    public int Id { get; set; }
    public string NameUk { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public string? AtcCode { get; set; }
    public string? DdinterId { get; set; }
}

// Взаємодія речовина↔речовина з DDInter 2.0 (CC BY-NC-SA). Level: Major | Moderate | Minor | Unknown.
// Зберігаємо пару один раз; у пошуку перевіряємо обидва напрямки (A-B і B-A).
public class SubstanceInteraction
{
    public int Id { get; set; }
    public int SubstanceAId { get; set; }
    public Substance? SubstanceA { get; set; }
    public int SubstanceBId { get; set; }
    public Substance? SubstanceB { get; set; }
    public string Level { get; set; } = string.Empty;
    public string? Mechanism { get; set; }
    public string Source { get; set; } = "DDInter";
}

// Форма випуску = "категорія" ліків у UI. Пластир/бинт/термометр мають Key="medical-device",
// щоб не плодити категорію з одного елемента (виправлення старого довідника).
public class MedicineForm
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty; // tablets | capsules | syrups | drops | ointments | sprays | ...
    public string NameUk { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
}

// Торгова назва ліків (ДРЛЗ). З реєстру беремо лише назву, діючу речовину й форму.
// IsOtc — лише безрецептурні потрапляють у довідник.
public class Medicine
{
    public int Id { get; set; }
    public string NameUk { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public int? SubstanceId { get; set; }
    public Substance? Substance { get; set; }
    public int FormId { get; set; }
    public MedicineForm? Form { get; set; }
    public bool IsOtc { get; set; } = true;
    public bool IsSystem { get; set; } = true;
    public int? CreatedByUserId { get; set; }
}

// Ліки в аптечці користувача. ExpiresAt необов'язкове й ненав'язливе в UI (без окремої колонки "Термін").
public class UserMedicine
{
    public int UserId { get; set; }
    public User? User { get; set; }
    public int MedicineId { get; set; }
    public Medicine? Medicine { get; set; }
    public string State { get; set; } = "Available"; // Available | RunningLow | OutOfStock
    public DateTime? ExpiresAt { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;
}

// Хвороба користувача. Якщо AffectsFood — заводимо UserTagPreference із тим самим TagId/Relation,
// щоб рушій правил фільтрував страви. Хвороби без впливу на їжу — просто запис для користувача.
public class UserCondition
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string NameUk { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public bool AffectsFood { get; set; }
    public int? TagId { get; set; }
    public Tag? Tag { get; set; }
    public string Relation { get; set; } = "Avoid"; // Forbidden | Avoid
}
