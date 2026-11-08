using Microsoft.EntityFrameworkCore;
using Server.Data;

namespace Server.Services;

// Керування акаунтом: повне видалення даних, видалення самого акаунта та експорт усіх даних у JSON.
// Видалення — набором ExecuteDelete у безпечному порядку (FK RESTRICT між Tasks→RecurrenceRules та
// WorkShiftEntries→WorkShiftTypes вимагають спершу прибрати залежні рядки). Усе в одній транзакції.
public class AccountService
{
    private readonly AppDbContext _db;

    public AccountService(AppDbContext db)
    {
        _db = db;
    }

    // Видалити ВЕСЬ користувацький контент, але лишити акаунт придатним до користування
    // (User, UserProfile, UserModules зберігаються — профіль і налаштування не чіпаємо).
    public async Task WipeContentAsync(int userId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        // 1) Спершу рядки, що тримають RESTRICT-посилання на правила/типи змін
        await _db.Tasks.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.StudyScheduleEntries.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.WorkShiftEntries.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        // 2) Тепер самі правила (каскадом приберуть винятки й ручні дати) та типи змін
        await _db.RecurrenceRules.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.WorkShiftTypes.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        // 3) Навчання: кроки проєктів (через проєкт) → проєкти → решта
        await _db.StudyProjectSteps.Where(x => x.Project!.UserId == userId).ExecuteDeleteAsync();
        await _db.StudyProjects.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.StudyAssignments.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.StudySubjects.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.BellPeriods.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.StudySettings.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        // 4) Решта плоских таблиць контенту (всі з User FK = каскад, але видаляємо явно й по порядку)
        await _db.StockItems.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.SelectedDishes.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.UserRecipeStates.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.FoodMenuItems.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        await _db.UserMedicines.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.UserConditions.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        await _db.FinanceTransactions.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.FinanceLimits.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.FinanceHiddenCategories.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.FinanceAccounts.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        await _db.CycleRecords.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.CycleSettings.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        await _db.ShoppingItems.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.UserProductPrices.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.PurchaseHistories.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        await _db.MediaItems.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        await _db.WorkContacts.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.WorkLeaves.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.WorkMeetings.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.WorkObligations.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.WorkSettings.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        await _db.Notes.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.HealthVisits.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.UserVaccinations.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        // Персоналізація їжі/здоров'я, похідна від контенту
        await _db.Rules.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.UserTagPreferences.Where(x => x.UserId == userId).ExecuteDeleteAsync();

        await tx.CommitAsync();
    }

    // Повне видалення акаунта: спершу весь контент, далі модулі, профіль, коди підтвердження та сам User.
    public async Task<bool> DeleteAccountAsync(int userId)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return false;
        var email = user.Email;

        await WipeContentAsync(userId);

        await using var tx = await _db.Database.BeginTransactionAsync();
        await _db.UserModules.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _db.UserProfiles.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        // Коди підтвердження прив'язані до email, а не до UserId — чистимо окремо
        await _db.EmailVerificationCodes.Where(c => c.Email == email).ExecuteDeleteAsync();
        await _db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync();
        await tx.CommitAsync();
        return true;
    }

    // Зібрати всі дані користувача в один об'єкт для експорту в JSON. Навігації не підвантажуємо
    // (щоб не тягнути зайве й не було циклів); дочірні рядки читаємо окремими списками.
    public async Task<object?> ExportAsync(int userId)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return null;

        return new
        {
            exportedAt = DateTime.UtcNow,
            account = new
            {
                user.Id, user.Nickname, user.Email, user.IsEmailConfirmed,
                user.CreatedAt, user.LastActiveAt,
            },
            profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId),
            modules = await _db.UserModules.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            tagPreferences = await _db.UserTagPreferences.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            rules = await _db.Rules.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),

            tasks = await _db.Tasks.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            recurrenceRules = await _db.RecurrenceRules.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            recurrenceExceptions = await _db.RecurrenceExceptions.AsNoTracking().Where(x => x.RecurrenceRule!.UserId == userId).ToListAsync(),
            recurrenceManualDates = await _db.ManualRecurrenceDates.AsNoTracking().Where(x => x.RecurrenceRule!.UserId == userId).ToListAsync(),

            food = new
            {
                stock = await _db.StockItems.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                selectedDishes = await _db.SelectedDishes.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                recipeStates = await _db.UserRecipeStates.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                weeklyMenu = await _db.FoodMenuItems.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            },
            health = new
            {
                medicines = await _db.UserMedicines.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                conditions = await _db.UserConditions.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                visits = await _db.HealthVisits.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                vaccinations = await _db.UserVaccinations.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            },
            finance = new
            {
                account = await _db.FinanceAccounts.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId),
                limits = await _db.FinanceLimits.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                transactions = await _db.FinanceTransactions.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                hiddenCategories = await _db.FinanceHiddenCategories.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            },
            cycle = new
            {
                records = await _db.CycleRecords.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                settings = await _db.CycleSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId),
            },
            shopping = new
            {
                items = await _db.ShoppingItems.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                prices = await _db.UserProductPrices.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                history = await _db.PurchaseHistories.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            },
            media = await _db.MediaItems.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            study = new
            {
                subjects = await _db.StudySubjects.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                assignments = await _db.StudyAssignments.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                bellPeriods = await _db.BellPeriods.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                settings = await _db.StudySettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId),
                scheduleEntries = await _db.StudyScheduleEntries.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                projects = await _db.StudyProjects.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                projectSteps = await _db.StudyProjectSteps.AsNoTracking().Where(x => x.Project!.UserId == userId).ToListAsync(),
            },
            work = new
            {
                settings = await _db.WorkSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId),
                shiftTypes = await _db.WorkShiftTypes.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                shiftEntries = await _db.WorkShiftEntries.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                contacts = await _db.WorkContacts.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                leaves = await _db.WorkLeaves.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                meetings = await _db.WorkMeetings.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
                obligations = await _db.WorkObligations.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
            },
            notes = await _db.Notes.AsNoTracking().Where(x => x.UserId == userId).ToListAsync(),
        };
    }
}
