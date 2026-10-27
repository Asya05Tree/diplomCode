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

    public record ConditionDto(int Id, string NameUk, string? NameEn, bool AffectsFood, string? TagKey, string Relation);

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
        var q = (query ?? "").Trim();
        if (q.Length == 0) return new List<SearchResultDto>();

        var inCabinet = await _db.UserMedicines.Where(x => x.UserId == userId).Select(x => x.MedicineId).ToListAsync();

        // Пошук за торговою назвою (укр/англ) або назвою діючої речовини; ~30 рядків для пікера
        return await _db.Medicines
            .Include(m => m.Form)
            .Include(m => m.Substance)
            .Where(m => !inCabinet.Contains(m.Id) && (
                m.NameUk.Contains(q) || m.NameEn.Contains(q) ||
                (m.Substance != null && (m.Substance.NameUk.Contains(q) || m.Substance.NameEn.Contains(q)))))
            .OrderBy(m => m.NameUk)
            .Take(30)
            .Select(m => new SearchResultDto(
                m.Id, m.NameUk, m.NameEn, m.Form!.Key,
                m.Substance != null ? m.Substance.NameUk : null,
                m.Substance != null ? m.Substance.NameEn : null))
            .ToListAsync();
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
        return await _db.UserConditions
            .Where(x => x.UserId == userId)
            .Include(x => x.Tag)
            .Select(x => new ConditionDto(x.Id, x.NameUk, x.NameEn, x.AffectsFood,
                x.Tag != null ? x.Tag.Key : null, x.Relation))
            .ToListAsync();
    }

    public async Task<ConditionDto> AddConditionAsync(int userId, string nameUk, bool affectsFood, string? tag, string relation)
    {
        var rel = relation == "Forbidden" ? "Forbidden" : "Avoid";
        int? tagId = null;
        string? tagKey = null;

        // Якщо хвороба впливає на їжу й задано тег — гарантуємо наявність тега (ключ у нижньому регістрі,
        // щоб збігався з довідником продуктів) і заводимо UserTagPreference для рушія правил "Їжі".
        if (affectsFood && !string.IsNullOrWhiteSpace(tag))
        {
            tagKey = tag.Trim().ToLowerInvariant();
            var tagEntity = await _db.Tags.FirstOrDefaultAsync(t => t.Key == tagKey);
            if (tagEntity is null)
            {
                tagEntity = new Tag { Namespace = "allergen", Key = tagKey, DisplayName = tag.Trim() };
                _db.Tags.Add(tagEntity);
                await _db.SaveChangesAsync();
            }
            tagId = tagEntity.Id;

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

        return new ConditionDto(condition.Id, condition.NameUk, condition.NameEn, condition.AffectsFood, tagKey, rel);
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
