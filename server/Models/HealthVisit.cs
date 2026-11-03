namespace Server.Models;

// Запланований візит до лікаря (чекап у розділі "Здоров'я"). DoctorKey — ключ зі сталого переліку
// спеціальностей (family — сімейний лікар — зверху). Створює подію в спільному календарі
// (ModuleCode="health") через TaskService, тож візит видно й у головному календарі.
public class HealthVisit
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string DoctorKey { get; set; } = ""; // family | therapist | dentist | ...
    public DateTime When { get; set; }           // дата й час візиту
    public string? Place { get; set; }           // клініка / кабінет / посилання
    public string? Note { get; set; }
    public int? TaskId { get; set; }             // пов'язана подія календаря (логічне посилання)
}
