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
    }
}
