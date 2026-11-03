using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// planner-spec.md §3.7. Цикл: записи про менструації + прогноз наступної дати. Прогноз чесний:
// без даних — ±5 днів; один запис — орієнтир за середнім циклом 28 днів; кілька — середнє з
// позначкою регулярності (широкий діапазон і пояснення, якщо розкид великий). Налаштування —
// рядок на користувача (створюється лінуво). Пропущена відмітка не додумується (нові записи — явні).
public class CycleService
{
    private readonly AppDbContext _db;
    private readonly ShoppingService _shopping;

    public CycleService(AppDbContext db, ShoppingService shopping)
    {
        _db = db;
        _shopping = shopping;
    }

    private const int DefaultCycleLength = 28;
    private const int NoDataRangeDays = 5;
    private const int RegularSpreadThresholdDays = 3;
    private const int SupplyLeadDays = 5;      // за скільки днів до початку нагадувати про засіб
    private const int OpenPeriodMaxDays = 8;   // відкритий запис вважаємо "триває" не довше за це

    // Назви засобів гігієни для позиції у списку покупок (застосунок україномовний)
    private static readonly Dictionary<string, string> HygieneNames = new()
    {
        ["pads"] = "Прокладки",
        ["tampons"] = "Тампони",
        ["cup"] = "Менструальна чаша",
        ["liners"] = "Щоденні прокладки",
        ["other"] = "Засіб гігієни",
    };

    public record RecordDto(int Id, DateOnly StartDate, DateOnly? EndDate);
    public record SettingsDto(bool ReduceLoadOnHeavyDays, string? HygieneProduct);
    public record ForecastDto(bool HasData, bool InsufficientHistory, DateOnly? PredictedDate, int RangeDays, bool? IsRegular, int? AverageLength);
    public record CycleDto(List<RecordDto> Records, SettingsDto Settings, ForecastDto Forecast);

    public async Task<CycleDto> GetAsync(int userId)
    {
        var records = await _db.CycleRecords
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.StartDate)
            .Select(x => new RecordDto(x.Id, x.StartDate, x.EndDate))
            .ToListAsync();

        var settings = await _db.CycleSettings.FindAsync(userId);
        if (settings is null)
        {
            settings = new CycleSettings { UserId = userId };
            _db.CycleSettings.Add(settings);
            await _db.SaveChangesAsync();
        }

        // Лениво перевіряємо, чи треба докинути засіб гігієни у список покупок
        await EnsureHygieneSupplyAsync(userId, records, settings);

        return new CycleDto(records, new SettingsDto(settings.ReduceLoadOnHeavyDays, settings.HygieneProduct), ComputeForecast(records));
    }

    // Дзеркалить utils/cycle.js computeForecast — логіку прогнозу тримаємо однаковою на клієнті й сервері.
    private static ForecastDto ComputeForecast(List<RecordDto> records)
    {
        var starts = records.Select(r => r.StartDate).OrderBy(d => d).ToList();
        if (starts.Count == 0)
            return new ForecastDto(false, false, null, NoDataRangeDays, null, null);

        var last = starts[^1];
        if (starts.Count == 1)
            return new ForecastDto(true, true, last.AddDays(DefaultCycleLength), NoDataRangeDays, null, null);

        var lengths = new List<int>();
        for (var i = 1; i < starts.Count; i++)
            lengths.Add(starts[i].DayNumber - starts[i - 1].DayNumber);

        var avg = lengths.Average();
        var spread = lengths.Max() - lengths.Min();
        var isRegular = spread <= RegularSpreadThresholdDays;
        var rangeDays = isRegular ? 2 : (int)Math.Ceiling(spread / 2.0) + 2;

        return new ForecastDto(true, false, last.AddDays((int)Math.Round(avg)), rangeDays, isRegular, (int)Math.Round(avg));
    }

    public async Task<int> AddRecordAsync(int userId, DateOnly startDate)
    {
        var record = new CycleRecord { UserId = userId, StartDate = startDate };
        _db.CycleRecords.Add(record);
        await _db.SaveChangesAsync();
        await EnsureHygieneSupplyAsync(userId);
        return record.Id;
    }

    // Дата-орієнтовані операції (для позначення кліком на будь-якому календарі — дані єдині).
    // Початок: створюємо запис на цю дату, якщо такого старту ще нема (без дублів).
    public async Task<int> StartByDateAsync(int userId, DateOnly date)
    {
        var existing = await _db.CycleRecords.FirstOrDefaultAsync(x => x.UserId == userId && x.StartDate == date);
        if (existing is not null) return existing.Id;
        return await AddRecordAsync(userId, date);
    }

    // Кінець: ставимо EndDate найпізнішому запису, що почався не пізніше за цю дату.
    public async Task<bool> EndByDateAsync(int userId, DateOnly date)
    {
        var record = await _db.CycleRecords
            .Where(x => x.UserId == userId && x.StartDate <= date)
            .OrderByDescending(x => x.StartDate)
            .FirstOrDefaultAsync();
        if (record is null) return false;
        record.EndDate = date;
        await _db.SaveChangesAsync();
        await EnsureHygieneSupplyAsync(userId);
        return true;
    }

    // Прибрати: якщо дата = старт запису — видаляємо запис; якщо = його кінець — обнуляємо кінець.
    public async Task<bool> ClearByDateAsync(int userId, DateOnly date)
    {
        var asStart = await _db.CycleRecords.FirstOrDefaultAsync(x => x.UserId == userId && x.StartDate == date);
        if (asStart is not null)
        {
            _db.CycleRecords.Remove(asStart);
            await _db.SaveChangesAsync();
            return true;
        }
        var asEnd = await _db.CycleRecords.FirstOrDefaultAsync(x => x.UserId == userId && x.EndDate == date);
        if (asEnd is not null)
        {
            asEnd.EndDate = null;
            await _db.SaveChangesAsync();
            return true;
        }
        return false;
    }

    public async Task<bool> EndRecordAsync(int userId, int id, DateOnly endDate)
    {
        var record = await _db.CycleRecords.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (record is null) return false;
        record.EndDate = endDate;
        await _db.SaveChangesAsync();
        await EnsureHygieneSupplyAsync(userId);
        return true;
    }

    public async Task<bool> DeleteRecordAsync(int userId, int id)
    {
        var record = await _db.CycleRecords.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (record is null) return false;
        _db.CycleRecords.Remove(record);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task SetSettingsAsync(int userId, bool reduceLoadOnHeavyDays, string? hygieneProduct)
    {
        var settings = await _db.CycleSettings.FindAsync(userId);
        if (settings is null)
        {
            settings = new CycleSettings { UserId = userId };
            _db.CycleSettings.Add(settings);
        }
        settings.ReduceLoadOnHeavyDays = reduceLoadOnHeavyDays;
        // Приймаємо лише відомі ключі засобу; інше — як "нічого не обрано"
        settings.HygieneProduct = hygieneProduct is not null && HygieneNames.ContainsKey(hygieneProduct) ? hygieneProduct : null;
        await _db.SaveChangesAsync();
        await EnsureHygieneSupplyAsync(userId);
    }

    // Якщо обрано засіб гігієни і місячні скоро (≤5 днів до прогнозу) або тривають — додаємо
    // засіб у список покупок (розділ "Аптека"), але лише якщо незакресленої позиції з Source="Cycle"
    // ще нема (без дублів). Нічого не видаляємо — користувачка сама закреслює куплене.
    private async Task EnsureHygieneSupplyAsync(int userId, List<RecordDto>? records = null, CycleSettings? settings = null)
    {
        settings ??= await _db.CycleSettings.FindAsync(userId);
        if (settings?.HygieneProduct is null || !HygieneNames.ContainsKey(settings.HygieneProduct)) return;

        records ??= await _db.CycleRecords
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.StartDate)
            .Select(x => new RecordDto(x.Id, x.StartDate, x.EndDate))
            .ToListAsync();

        var today = DateOnly.FromDateTime(DateTime.Today);

        // Місячні тривають: сьогодні в межах закритого запису, або відкритий запис почався недавно
        var ongoing = records.Any(r =>
            r.StartDate <= today &&
            (r.EndDate.HasValue ? today <= r.EndDate.Value : today <= r.StartDate.AddDays(OpenPeriodMaxDays)));

        // Скоро: прогноз у межах 5 днів попереду
        var forecast = ComputeForecast(records);
        var soon = forecast.PredictedDate is { } pd && today <= pd && pd.DayNumber - today.DayNumber <= SupplyLeadDays;

        if (!ongoing && !soon) return;

        var alreadyThere = await _db.ShoppingItems
            .AnyAsync(x => x.UserId == userId && x.Source == "Cycle" && !x.IsChecked);
        if (alreadyThere) return;

        await _shopping.AddItemAsync(userId, "Pharmacy", "гігієна", HygieneNames[settings.HygieneProduct], null, null,
            source: "Cycle");
    }
}
