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
    }
}
