using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// planner-spec.md §3.5. Аптечка користувача: ліки з довідника ДРЛЗ (2038 рядків) додаються в
// особисту аптечку (UserMedicine), взаємодії шукаються на рівні діючої речовини через DDInter
// (SubstanceInteraction, обидва напрямки). Хвороби (UserCondition), що впливають на їжу,
// заводять UserTagPreference — і далі їх бачить рушій правил "Їжі" (єдиний механізм обмежень).
public class MedicineService
{
    private readonly AppDbContext _db;

    public MedicineService(AppDbContext db)
    {
        _db = db;
    }

    public record CabinetItemDto(
        int MedicineId, string NameUk, string NameEn, string FormKey, string FormNameUk, string FormNameEn,
        string? SubstanceUk, string? SubstanceEn, string State, DateTime? ExpiresAt);

    public record SearchResultDto(
        int Id, string NameUk, string NameEn, string FormKey, string? SubstanceUk, string? SubstanceEn);

    public record InteractionDto(
        string OtherMedicineNameUk, string OtherMedicineNameEn, string SubstanceUk, string SubstanceEn,
        string Level, string? Mechanism);

    public record ConditionDto(int Id, string NameUk, string? NameEn, bool AffectsFood, string? TagKey, string? TagNameUk, string Relation, bool TagKnown);

    public record TagSuggestionDto(string Key, string DisplayName);

    // ---- Аптечка -------------------------------------------------------------

    public async Task<List<CabinetItemDto>> GetCabinetAsync(int userId)
    {
        return await _db.UserMedicines
            .Where(x => x.UserId == userId)
            .Include(x => x.Medicine!).ThenInclude(m => m.Form)
            .Include(x => x.Medicine!).ThenInclude(m => m.Substance)
            .Select(x => new CabinetItemDto(
                x.MedicineId, x.Medicine!.NameUk, x.Medicine.NameEn,
                x.Medicine.Form!.Key, x.Medicine.Form.NameUk, x.Medicine.Form.NameEn,
                x.Medicine.Substance != null ? x.Medicine.Substance.NameUk : null,
                x.Medicine.Substance != null ? x.Medicine.Substance.NameEn : null,
                x.State, x.ExpiresAt))
            .ToListAsync();
    }

    public async Task<List<SearchResultDto>> SearchAsync(int userId, string query)
    {
        var q = (query ?? "").Trim().ToLowerInvariant();
        if (q.Length == 0) return new List<SearchResultDto>();

        // Мова запиту визначається за алфавітом: суто латиниця → англ. поля, суто кирилиця → укр.
        // Змішаний алфавіт або лише цифри/символи (нi укр., нi англ.) — результатів не даємо.
        var lang = DetectScript(q);
        if (lang is null) return new List<SearchResultDto>();

        var queryGrams = Trigrams(q);
        if (queryGrams.Count == 0) return new List<SearchResultDto>();

        var inCabinet = await _db.UserMedicines.Where(x => x.UserId == userId).Select(x => x.MedicineId).ToListAsync();

        // Довідник невеликий (~2 тис. рядків), тож тягнемо легку проекцію й рахуємо триграмну
        // подібність у памʼяті — пошук терпить до одруків, на відміну від простого Contains.
        var candidates = await _db.Medicines
            .Where(m => !inCabinet.Contains(m.Id))
            .Select(m => new
            {
                m.Id, m.NameUk, m.NameEn, m.SubstanceId, FormKey = m.Form!.Key,
                SubstanceUk = m.Substance != null ? m.Substance.NameUk : null,
                SubstanceEn = m.Substance != null ? m.Substance.NameEn : null,
            })
            .ToListAsync();

        return candidates
            .Select(m =>
            {
                var name = lang == "en" ? m.NameEn : m.NameUk;
                var substance = lang == "en" ? m.SubstanceEn : m.SubstanceUk;
                // Збіг або за назвою, або за діючою речовиною — беремо кращий із двох
                var score = Math.Max(TrigramScore(queryGrams, name), TrigramScore(queryGrams, substance));
                return (m, score);
            })
            .Where(x => x.score > 0)
            .OrderByDescending(x => x.score)
            .ThenBy(x => lang == "en" ? x.m.NameEn : x.m.NameUk)
            // Підстраховка: однакові за назвою+речовиною картки не дублюємо у видачі (лишаємо кращу)
            .DistinctBy(x => (x.m.NameUk, x.m.SubstanceId))
            .Take(20)
            .Select(x => new SearchResultDto(x.m.Id, x.m.NameUk, x.m.NameEn, x.m.FormKey, x.m.SubstanceUk, x.m.SubstanceEn))
            .ToList();
    }

    // Підказки тегів для форми захворювання: ТІЛЬКИ теги, що реально стоять на продуктах (запасах),
    // бо хвороба фільтрує саме страви/продукти. Збіг за ключем або укр. назвою (підрядок або триграми).
    public async Task<List<TagSuggestionDto>> SearchTagsAsync(string query)
    {
        var q = (query ?? "").Trim().ToLowerInvariant();
        if (q.Length == 0) return new List<TagSuggestionDto>();

        var tagIds = await _db.ProductTags.Select(pt => pt.TagId).Distinct().ToListAsync();
        var tags = await _db.Tags.Where(t => tagIds.Contains(t.Id)).ToListAsync();

        var grams = Trigrams(q);
        return tags
            .Select(t =>
            {
                var key = t.Key.ToLowerInvariant();
                var name = t.DisplayName.ToLowerInvariant();
                var score = Math.Max(
                    key.Contains(q) ? 1.0 : TrigramScore(grams, key),
                    name.Contains(q) ? 1.0 : TrigramScore(grams, name));
                return (t, score);
            })
            .Where(x => x.score > 0)
            .OrderByDescending(x => x.score)
            .ThenBy(x => x.t.Key)
            .Take(5)
            .Select(x => new TagSuggestionDto(x.t.Key, x.t.DisplayName))
            .ToList();
    }

    // Алфавіт запиту: "en" (суто латиниця), "uk" (суто кирилиця) або null (змішаний/без літер).
    private static string? DetectScript(string s)
    {
        bool hasLatin = false, hasCyrillic = false;
        foreach (var ch in s)
        {
            if (ch is >= 'a' and <= 'z') hasLatin = true;
            else if (ch is >= 'Ѐ' and <= 'ӿ') hasCyrillic = true;
        }
        if (hasCyrillic && !hasLatin) return "uk";
        if (hasLatin && !hasCyrillic) return "en";
        return null;
    }

    // Набір 3-грам рядка з пробілом-доповненням з боків (щоб короткі запити/префікси теж давали грами).
    private static HashSet<string> Trigrams(string? text)
    {
        var result = new HashSet<string>();
        if (string.IsNullOrWhiteSpace(text)) return result;
        var padded = " " + text.Trim().ToLowerInvariant() + " ";
        for (var i = 0; i + 3 <= padded.Length; i++)
            result.Add(padded.Substring(i, 3));
        return result;
    }

    // Подібність Жаккара між готовим набором грам запиту й грамами кандидата (0..1).
    private static double TrigramScore(HashSet<string> queryGrams, string? candidate)
    {
        var other = Trigrams(candidate);
        if (other.Count == 0 || queryGrams.Count == 0) return 0;
        var intersection = queryGrams.Count(g => other.Contains(g));
        if (intersection == 0) return 0;
        var union = queryGrams.Count + other.Count - intersection;
        return (double)intersection / union;
    }

    public async Task<bool> AddToCabinetAsync(int userId, int medicineId)
    {
        var exists = await _db.Medicines.AnyAsync(m => m.Id == medicineId);
        if (!exists) return false;
        var already = await _db.UserMedicines.AnyAsync(x => x.UserId == userId && x.MedicineId == medicineId);
        if (already) return true;

        _db.UserMedicines.Add(new UserMedicine { UserId = userId, MedicineId = medicineId, State = "Available" });
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateCabinetAsync(int userId, int medicineId, string state, DateTime? expiresAt)
    {
        if (state is not ("Available" or "RunningLow" or "OutOfStock")) return false;
        var item = await _db.UserMedicines.FirstOrDefaultAsync(x => x.UserId == userId && x.MedicineId == medicineId);
        if (item is null) return false;

        item.State = state;
        item.ExpiresAt = expiresAt;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveFromCabinetAsync(int userId, int medicineId)
    {
        var item = await _db.UserMedicines.FirstOrDefaultAsync(x => x.UserId == userId && x.MedicineId == medicineId);
        if (item is null) return false;
        _db.UserMedicines.Remove(item);
        await _db.SaveChangesAsync();
        return true;
    }

    // Взаємодії для одних ліків: беремо їхню діючу речовину й шукаємо пари (обидва напрямки A-B/B-A),
    // де ДРУГА речовина теж присутня в аптечці користувача. Комбіновані ліки (SubstanceId=null) взаємодій не мають.
    public async Task<List<InteractionDto>> GetInteractionsAsync(int userId, int medicineId)
    {
        var med = await _db.UserMedicines
            .Include(x => x.Medicine!).ThenInclude(m => m.Substance)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.MedicineId == medicineId);
        if (med?.Medicine?.SubstanceId is not int substanceId)
            return new List<InteractionDto>();

        // Речовини всіх інших ліків аптечки -> перші ліки з кожною речовиною (для назви у відповіді)
        var cabinet = await _db.UserMedicines
            .Where(x => x.UserId == userId && x.MedicineId != medicineId)
            .Include(x => x.Medicine!).ThenInclude(m => m.Substance)
            .ToListAsync();
        var medBySubstance = cabinet
            .Where(x => x.Medicine?.SubstanceId != null)
            .GroupBy(x => x.Medicine!.SubstanceId!.Value)
            .ToDictionary(g => g.Key, g => g.First().Medicine!);
        if (medBySubstance.Count == 0) return new List<InteractionDto>();

        var otherIds = medBySubstance.Keys.ToList();
        var interactions = await _db.SubstanceInteractions
            .Include(i => i.SubstanceA)
            .Include(i => i.SubstanceB)
            .Where(i =>
                (i.SubstanceAId == substanceId && otherIds.Contains(i.SubstanceBId)) ||
                (i.SubstanceBId == substanceId && otherIds.Contains(i.SubstanceAId)))
            .ToListAsync();

        var result = new List<InteractionDto>();
        foreach (var i in interactions)
        {
            // Друга речовина пари — та, що не дорівнює речовині обраних ліків
            var otherSubstanceId = i.SubstanceAId == substanceId ? i.SubstanceBId : i.SubstanceAId;
            var otherSubstance = i.SubstanceAId == substanceId ? i.SubstanceB : i.SubstanceA;
            if (!medBySubstance.TryGetValue(otherSubstanceId, out var otherMed)) continue;

            result.Add(new InteractionDto(
                otherMed.NameUk, otherMed.NameEn,
                otherSubstance?.NameUk ?? "", otherSubstance?.NameEn ?? "",
                i.Level, i.Mechanism));
        }
        return result;
    }

    // ---- Хвороби (UserCondition) ---------------------------------------------

    public async Task<List<ConditionDto>> GetConditionsAsync(int userId)
    {
        var conditions = await _db.UserConditions
            .Where(x => x.UserId == userId)
            .Include(x => x.Tag)
            .ToListAsync();

        // Тег "відомий", якщо він стоїть хоч на одному продукті (запасах) — лише такі реально фільтрують страви
        var tagIds = conditions.Where(c => c.TagId != null).Select(c => c.TagId!.Value).Distinct().ToList();
        var knownTagIds = (await _db.ProductTags
            .Where(pt => tagIds.Contains(pt.TagId))
            .Select(pt => pt.TagId)
            .Distinct()
            .ToListAsync()).ToHashSet();

        return conditions
            .Select(x => new ConditionDto(x.Id, x.NameUk, x.NameEn, x.AffectsFood,
                x.Tag?.Key, x.Tag?.DisplayName, x.Relation, x.TagId != null && knownTagIds.Contains(x.TagId.Value)))
            .ToList();
    }

    public async Task<ConditionDto> AddConditionAsync(int userId, string nameUk, bool affectsFood, string? tag, string relation)
    {
        var rel = relation == "Forbidden" ? "Forbidden" : "Avoid";
        int? tagId = null;
        string? tagKey = null;
        string? tagNameUk = null;
        var tagKnown = false;

        // Якщо хвороба впливає на їжу й задано тег — знаходимо/створюємо тег і заводимо UserTagPreference
        // для рушія правил "Їжі".
        if (affectsFood && !string.IsNullOrWhiteSpace(tag))
        {
            var raw = tag.Trim();
            var norm = raw.ToLowerInvariant();

            // Синхронізація мов: введене укр. чи англ. зіставляємо з наявними тегами і за КЛЮЧЕМ (англ.),
            // і за ВІДОБРАЖУВАНОЮ НАЗВОЮ (укр.). Тож «яйце»/«Яйця»/«egg» → один і той самий тег egg.
            // Таблиця тегів маленька, тож порівнюємо в памʼяті (надійніше для кирилиці, ніж LOWER() у SQL).
            var allTags = await _db.Tags.ToListAsync();
            var tagEntity = allTags.FirstOrDefault(t =>
                string.Equals(t.Key, norm, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(t.DisplayName, raw, StringComparison.OrdinalIgnoreCase));

            if (tagEntity is null)
            {
                tagEntity = new Tag { Namespace = "allergen", Key = norm, DisplayName = raw };
                _db.Tags.Add(tagEntity);
                await _db.SaveChangesAsync();
            }
            tagId = tagEntity.Id;
            tagKey = tagEntity.Key;
            tagNameUk = tagEntity.DisplayName;

            // Тег "відомий" лише якщо він реально стоїть на продуктах (запасах) — лише такий фільтруватиме страви.
            // Невідомий (напр. вигадана "вафлі") усе одно зберігаємо, але клієнт попередить користувача.
            tagKnown = await _db.ProductTags.AnyAsync(pt => pt.TagId == tagId.Value);

            var pref = await _db.UserTagPreferences.FirstOrDefaultAsync(p => p.UserId == userId && p.TagId == tagId);
            if (pref is null)
                _db.UserTagPreferences.Add(new UserTagPreference { UserId = userId, TagId = tagId.Value, Relation = rel });
            else
                pref.Relation = rel;
        }

        var condition = new UserCondition
        {
            UserId = userId,
            NameUk = nameUk.Trim(),
            NameEn = nameUk.Trim(),
            AffectsFood = affectsFood && tagId != null,
            TagId = tagId,
            Relation = rel,
        };
        _db.UserConditions.Add(condition);
        await _db.SaveChangesAsync();

        return new ConditionDto(condition.Id, condition.NameUk, condition.NameEn, condition.AffectsFood, tagKey, tagNameUk, rel, tagKnown);
    }

    public async Task<bool> DeleteConditionAsync(int userId, int conditionId)
    {
        var condition = await _db.UserConditions.FirstOrDefaultAsync(x => x.Id == conditionId && x.UserId == userId);
        if (condition is null) return false;

        // Прибираємо й повʼязане харчове правило, щоб "Їжа" перестала фільтрувати за цією хворобою
        if (condition.TagId is int tagId)
        {
            var pref = await _db.UserTagPreferences.FirstOrDefaultAsync(p => p.UserId == userId && p.TagId == tagId);
            if (pref is not null) _db.UserTagPreferences.Remove(pref);
        }
        _db.UserConditions.Remove(condition);
        await _db.SaveChangesAsync();
        return true;
    }
}
