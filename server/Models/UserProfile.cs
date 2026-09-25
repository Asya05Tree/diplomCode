namespace Server.Models;

// Height/Weight — необов'язкові, приблизні (planner-spec.md §3.1)
public class UserProfile
{
    public int UserId { get; set; }
    public User? User { get; set; }

    public double? Height { get; set; }
    public double? Weight { get; set; }
    public int? BirthYear { get; set; }
    public string? Gender { get; set; }

    public TimeOnly DayStart { get; set; } = new(8, 0);
    public TimeOnly DayEnd { get; set; } = new(22, 0);

    public string Language { get; set; } = "uk";
    public string Theme { get; set; } = "light";
    public string AccentColor { get; set; } = "#8FB8DE";

    // Скільки днів зберігати виконані/пропущені задачі назад (coding-guide.md §9)
    public int HistoryRetentionDays { get; set; } = 90;
}
