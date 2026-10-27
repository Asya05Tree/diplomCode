using Microsoft.EntityFrameworkCore;
using Server.Models;

namespace Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<UserModule> UserModules => Set<UserModule>();
    public DbSet<EmailVerificationCode> EmailVerificationCodes => Set<EmailVerificationCode>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<UserTagPreference> UserTagPreferences => Set<UserTagPreference>();
    public DbSet<Rule> Rules => Set<Rule>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<RecurrenceRule> RecurrenceRules => Set<RecurrenceRule>();
    public DbSet<RecurrenceException> RecurrenceExceptions => Set<RecurrenceException>();
    public DbSet<ManualRecurrenceDate> ManualRecurrenceDates => Set<ManualRecurrenceDate>();

    // Їжа
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductTag> ProductTags => Set<ProductTag>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<RecipeIngredient> RecipeIngredients => Set<RecipeIngredient>();
    public DbSet<RecipeStep> RecipeSteps => Set<RecipeStep>();
    public DbSet<StockItem> StockItems => Set<StockItem>();
    public DbSet<SelectedDish> SelectedDishes => Set<SelectedDish>();
    public DbSet<UserRecipeState> UserRecipeStates => Set<UserRecipeState>();

    // Здоров'я / аптечка
    public DbSet<Substance> Substances => Set<Substance>();
    public DbSet<SubstanceInteraction> SubstanceInteractions => Set<SubstanceInteraction>();
    public DbSet<MedicineForm> MedicineForms => Set<MedicineForm>();
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<UserMedicine> UserMedicines => Set<UserMedicine>();
    public DbSet<UserCondition> UserConditions => Set<UserCondition>();

    // Фінанси
    public DbSet<FinanceAccount> FinanceAccounts => Set<FinanceAccount>();
    public DbSet<FinanceLimit> FinanceLimits => Set<FinanceLimit>();
    public DbSet<FinanceTransaction> FinanceTransactions => Set<FinanceTransaction>();

    // Цикл
    public DbSet<CycleRecord> CycleRecords => Set<CycleRecord>();
    public DbSet<CycleSettings> CycleSettings => Set<CycleSettings>();

    // Список покупок
    public DbSet<ShoppingItem> ShoppingItems => Set<ShoppingItem>();
    public DbSet<UserProductPrice> UserProductPrices => Set<UserProductPrice>();
    public DbSet<PurchaseHistory> PurchaseHistories => Set<PurchaseHistory>();

    // ToDo
    public DbSet<TodoItem> TodoItems => Set<TodoItem>();

    // Навчання
    public DbSet<StudySubject> StudySubjects => Set<StudySubject>();
    public DbSet<StudyAssignment> StudyAssignments => Set<StudyAssignment>();
    public DbSet<BellPeriod> BellPeriods => Set<BellPeriod>();
    public DbSet<GradeScaleEntry> GradeScaleEntries => Set<GradeScaleEntry>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Гроші — фіксована точність, щоб MySQL не тягнув дефолтний decimal(65,30)
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<UserProfile>()
            .HasKey(p => p.UserId);

        modelBuilder.Entity<UserModule>()
            .HasKey(m => new { m.UserId, m.ModuleCode });

        modelBuilder.Entity<EmailVerificationCode>()
            .HasIndex(c => c.Email);

        // Самопосилання Tag.ParentId — забороняємо каскадне видалення, щоб видалення батька не зносило все дерево нащадків
        modelBuilder.Entity<Tag>()
            .HasOne(t => t.Parent)
            .WithMany()
            .HasForeignKey(t => t.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserTagPreference>()
            .HasKey(p => new { p.UserId, p.TagId });

        // Частий фільтр у TaskService (день/період/sweep) — задачі користувача, впорядковані за часом
        modelBuilder.Entity<TaskItem>()
            .HasIndex(t => new { t.UserId, t.StartDateTime });

        // Restrict, а не каскад: шаблон-задачу правила видаляємо явно в сервісі разом із винятками,
        // щоб не забути частину звʼязаних даних
        modelBuilder.Entity<TaskItem>()
            .HasOne(t => t.RecurrenceRule)
            .WithMany()
            .HasForeignKey(t => t.RecurrenceRuleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RecurrenceRule>()
            .HasIndex(r => r.UserId);

        // А ось винятки без правила не мають сенсу — тут каскад доречний
        modelBuilder.Entity<RecurrenceException>()
            .HasOne(e => e.RecurrenceRule)
            .WithMany(r => r.Exceptions)
            .HasForeignKey(e => e.RecurrenceRuleId)
            .OnDelete(DeleteBehavior.Cascade);

        // Ручні дати (Type=Manual) так само належать конкретному правилу — каскад
        modelBuilder.Entity<ManualRecurrenceDate>()
            .HasOne(m => m.RecurrenceRule)
            .WithMany(r => r.ManualDates)
            .HasForeignKey(m => m.RecurrenceRuleId)
            .OnDelete(DeleteBehavior.Cascade);

        ConfigureFood(modelBuilder);
        ConfigureMedicine(modelBuilder);
        ConfigureFinance(modelBuilder);
        ConfigureCycle(modelBuilder);
        ConfigureShopping(modelBuilder);
        ConfigureStudy(modelBuilder);

        // ToDo — проста таблиця, впорядкована за статусом+позицією
        modelBuilder.Entity<TodoItem>()
            .HasIndex(x => new { x.UserId, x.Status, x.OrderIndex });
    }

    // Загальне правило для нових таблиць: FK на користувача каскадний (видалили акаунт — пішли його дані),
    // а FK на довідкові таблиці (Product/Recipe/Medicine/Tag/Substance) — Restrict, щоб видалення
    // довідкового запису не зносило мовчки користувацькі дані й не плодило кілька каскадних шляхів.

    private static void ConfigureFood(ModelBuilder b)
    {
        b.Entity<ProductTag>().HasKey(x => new { x.ProductId, x.TagId });
        b.Entity<ProductTag>()
            .HasOne(x => x.Product).WithMany(p => p.Tags)
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ProductTag>()
            .HasOne(x => x.Tag).WithMany()
            .HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<RecipeIngredient>()
            .HasOne(x => x.Recipe).WithMany(r => r.Ingredients)
            .HasForeignKey(x => x.RecipeId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<RecipeIngredient>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<RecipeStep>()
            .HasOne(x => x.Recipe).WithMany(r => r.Steps)
            .HasForeignKey(x => x.RecipeId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<StockItem>().HasKey(x => new { x.UserId, x.ProductId });
        b.Entity<StockItem>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<SelectedDish>()
            .HasOne(x => x.Recipe).WithMany()
            .HasForeignKey(x => x.RecipeId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<UserRecipeState>().HasKey(x => new { x.UserId, x.RecipeId });
        b.Entity<UserRecipeState>()
            .HasOne(x => x.Recipe).WithMany()
            .HasForeignKey(x => x.RecipeId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureMedicine(ModelBuilder b)
    {
        // Дві FK на одну таблицю (A/B) — конфігуруємо явно, автозіставлення тут не спрацює
        b.Entity<SubstanceInteraction>()
            .HasOne(x => x.SubstanceA).WithMany()
            .HasForeignKey(x => x.SubstanceAId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<SubstanceInteraction>()
            .HasOne(x => x.SubstanceB).WithMany()
            .HasForeignKey(x => x.SubstanceBId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<SubstanceInteraction>()
            .HasIndex(x => new { x.SubstanceAId, x.SubstanceBId });

        b.Entity<Medicine>()
            .HasOne(x => x.Substance).WithMany()
            .HasForeignKey(x => x.SubstanceId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<Medicine>()
            .HasOne(x => x.Form).WithMany()
            .HasForeignKey(x => x.FormId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<UserMedicine>().HasKey(x => new { x.UserId, x.MedicineId });
        b.Entity<UserMedicine>()
            .HasOne(x => x.Medicine).WithMany()
            .HasForeignKey(x => x.MedicineId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<UserCondition>()
            .HasOne(x => x.Tag).WithMany()
            .HasForeignKey(x => x.TagId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureFinance(ModelBuilder b)
    {
        // UserId тут і PK, і FK (один рахунок на користувача). User не має зворотної навігації,
        // тому зв'язок задаємо явно, інакше EF створює зайву тіньову колонку UserId1.
        b.Entity<FinanceAccount>().HasKey(x => x.UserId);
        b.Entity<FinanceAccount>()
            .HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);

        b.Entity<FinanceLimit>().HasKey(x => new { x.UserId, x.PeriodType });
        b.Entity<FinanceTransaction>().HasIndex(x => new { x.UserId, x.OccurredAt });
    }

    private static void ConfigureCycle(ModelBuilder b)
    {
        // Той самий випадок спільного PK/FK, що й у FinanceAccount
        b.Entity<CycleSettings>().HasKey(x => x.UserId);
        b.Entity<CycleSettings>()
            .HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId);

        b.Entity<CycleRecord>().HasIndex(x => new { x.UserId, x.StartDate });
    }

    private static void ConfigureShopping(ModelBuilder b)
    {
        b.Entity<ShoppingItem>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ShoppingItem>()
            .HasOne(x => x.Medicine).WithMany()
            .HasForeignKey(x => x.MedicineId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ShoppingItem>().HasIndex(x => new { x.UserId, x.IsChecked });

        b.Entity<UserProductPrice>().HasKey(x => new { x.UserId, x.ProductId });
        b.Entity<UserProductPrice>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);

        b.Entity<PurchaseHistory>()
            .HasOne(x => x.Product).WithMany()
            .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<PurchaseHistory>().HasIndex(x => new { x.UserId, x.PurchasedAt });
    }

    private static void ConfigureStudy(ModelBuilder b)
    {
        // Видалення предмета не зносить завдання — просто відв'язує (SetNull на nullable FK)
        b.Entity<StudyAssignment>()
            .HasOne(x => x.Subject).WithMany()
            .HasForeignKey(x => x.SubjectId).OnDelete(DeleteBehavior.SetNull);
    }
}
