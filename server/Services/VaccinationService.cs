using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// Щеплення (вкладка "Здоров'я"). Довідник доз (VaccineDose) — системний; користувач лише відмічає
// зроблені дози (UserVaccination) датою + приміткою, або додає власне щеплення поза календарем.
// Статуси (до віку / строк минув / виконано / наступна) рахує клієнт із віку профілю — тут не зберігаємо.
// Планування візиту для майбутньої дози йде через наявний механізм чекапу (CheckupService) — окремого
// ендпоінта не потрібно.
public class VaccinationService
{
    private readonly AppDbContext _db;

    public VaccinationService(AppDbContext db)
    {
        _db = db;
    }

    public record DoseDto(int Id, string InfectionKey, string InfectionUk, string InfectionEn,
        int DoseNumber, string RuleType, int RuleValueMonths, string Source);

    public record RecordDto(int Id, int? VaccineDoseId, string? CustomName, int? DoseCount, DateTime DoneDate, string? Note);

    public record VaccinationDataDto(List<DoseDto> Doses, List<RecordDto> Records);

    // Увесь довідник доз (у стабільному порядку) + відмітки користувача.
    public async Task<VaccinationDataDto> GetAsync(int userId)
    {
        var doses = await _db.VaccineDoses
            .OrderBy(x => x.SortOrder)
            .Select(x => new DoseDto(x.Id, x.InfectionKey, x.InfectionUk, x.InfectionEn,
                x.DoseNumber, x.RuleType, x.RuleValueMonths, x.Source))
            .ToListAsync();
        var records = await _db.UserVaccinations
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.DoneDate)
            .Select(x => new RecordDto(x.Id, x.VaccineDoseId, x.CustomName, x.DoseCount, x.DoneDate, x.Note))
            .ToListAsync();
        return new VaccinationDataDto(doses, records);
    }

    // Відмітити дозу як виконану (або додати власне щеплення). Для дози довідника запис унікальний:
    // якщо вже є — оновлюємо дату/примітку (ідемпотентний «галочка» в чеклісті).
    public async Task<int> AddRecordAsync(int userId, int? doseId, string? customName, int? doseCount, DateTime doneDate, string? note)
    {
        var name = Trim(customName);
        if (doseId is null && name is null)
            throw new ArgumentException("either dose or custom name required");
        if (doseId is int id && !await _db.VaccineDoses.AnyAsync(d => d.Id == id))
            throw new ArgumentException("unknown dose");

        if (doseId is int did)
        {
            var existing = await _db.UserVaccinations
                .FirstOrDefaultAsync(x => x.UserId == userId && x.VaccineDoseId == did);
            if (existing is not null)
            {
                existing.DoneDate = doneDate;
                existing.Note = Clamp(note, TextLimits.Note);
                await _db.SaveChangesAsync();
                return existing.Id;
            }
        }

        Limits.Ensure(await _db.UserVaccinations.CountAsync(v => v.UserId == userId), Limits.Vaccinations, "vaccinations");
        var rec = new UserVaccination
        {
            UserId = userId,
            VaccineDoseId = doseId,
            CustomName = doseId is null ? Clamp(name, TextLimits.Name) : null,
            DoseCount = doseId is null ? ClampCount(doseCount) : null,
            DoneDate = doneDate,
            Note = Clamp(note, TextLimits.Note),
        };
        _db.UserVaccinations.Add(rec);
        await _db.SaveChangesAsync();
        return rec.Id;
    }

    // Оновлення запису. Для власного щеплення (VaccineDoseId == null) дозволяємо міняти назву й
    // кількість доз (якщо передані); дату/примітку міняємо завжди. Для дози довідника назва/
    // кількість фіксовані (вони з наказу) — ігноруємо ці поля.
    public async Task<bool> UpdateRecordAsync(int userId, int id, DateTime doneDate, string? note, string? customName, int? doseCount)
    {
        var rec = await _db.UserVaccinations.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (rec is null) return false;
        rec.DoneDate = doneDate;
        rec.Note = Clamp(note, TextLimits.Note);
        if (rec.VaccineDoseId is null)
        {
            var name = Clamp(customName, TextLimits.Name);
            if (name is not null) rec.CustomName = name;
            if (doseCount is not null) rec.DoseCount = ClampCount(doseCount);
        }
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteRecordAsync(int userId, int id)
    {
        var rec = await _db.UserVaccinations.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (rec is null) return false;
        _db.UserVaccinations.Remove(rec);
        await _db.SaveChangesAsync();
        return true;
    }

    // Кількість доз власного щеплення — у розумних межах [1,20]; null/нечисло → null.
    private static int? ClampCount(int? n) => n is int v ? Math.Clamp(v, 1, 20) : null;

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
    private static string? Clamp(string? s, int max)
    {
        var t = Trim(s);
        return t is null ? null : (t.Length > max ? t[..max] : t);
    }
}
