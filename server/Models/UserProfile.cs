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

    // Хто навчається (обирається при реєстрації, редагується в налаштуваннях). Керує виглядом
    // розділу "Навчання": school/university-режим, а "none" ховає розділ із меню взагалі.
    public string? StudentType { get; set; } // pupil | student | none
    public bool IsWorking { get; set; }

    // Окрема явна згода на обробку особливої категорії даних — здоров'я та менструальний цикл
    // (ЗУ №2297-VI ст.7, аналог GDPR ст.9). Доки null — модулі «Здоров'я»/«Цикл» показують екран
    // згоди замість вмісту. Загальної галочки при реєстрації для цих даних недостатньо.
    public DateTime? HealthConsentAt { get; set; }
}
