namespace Server.Models;

// planner-spec.md §3.2. ParentId — ієрархія: заборона на батька ловить і нащадків (dairy → cheese, kefir).
public class Tag
{
    public int Id { get; set; }
    public string Namespace { get; set; } = string.Empty; // allergen, nutrient, storage, substance, area
    public string Key { get; set; } = string.Empty;
    public int? ParentId { get; set; }
    public Tag? Parent { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}
