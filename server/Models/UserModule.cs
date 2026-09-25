namespace Server.Models;

// Вимкнений модуль не з'являється ніде: ні в навігації, ні в фільтрах (planner-spec.md §2.4)
public class UserModule
{
    public int UserId { get; set; }
    public User? User { get; set; }

    public string ModuleCode { get; set; } = string.Empty; // food, health, finance, study, cycle...
    public bool IsEnabled { get; set; } = true;
}
