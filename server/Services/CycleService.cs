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

    public CycleService(AppDbContext db)
    {
        _db = db;
    }

    private const int DefaultCycleLength = 28;
    private const int NoDataRangeDays = 5;
    private const int RegularSpreadThresholdDays = 3;

    public record RecordDto(int Id, DateOnly StartDate, DateOnly? EndDate);
    public record SettingsDto(bool ReduceLoadOnHeavyDays);
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

        return new CycleDto(records, new SettingsDto(settings.ReduceLoadOnHeavyDays), ComputeForecast(records));
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
        return record.Id;
    }

    public async Task<bool> EndRecordAsync(int userId, int id, DateOnly endDate)
    {
        var record = await _db.CycleRecords.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId);
        if (record is null) return false;
        record.EndDate = endDate;
        await _db.SaveChangesAsync();
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

    public async Task SetSettingsAsync(int userId, bool reduceLoadOnHeavyDays)
    {
        var settings = await _db.CycleSettings.FindAsync(userId);
        if (settings is null)
        {
            settings = new CycleSettings { UserId = userId };
            _db.CycleSettings.Add(settings);
        }
        settings.ReduceLoadOnHeavyDays = reduceLoadOnHeavyDays;
        await _db.SaveChangesAsync();
    }
}
