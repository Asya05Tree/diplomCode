namespace Server.Models;

// Проста дошка задач (три колонки). Окремо від TaskItem — це канбан без дат і повторень.
public class TodoItem
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Text { get; set; } = string.Empty;
    public string Status { get; set; } = "todo"; // todo | doing | done
    public int OrderIndex { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
