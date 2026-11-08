namespace Server.Models;

// Нотатка-«квадратик»: короткий текст з обмеженою довжиною, свій пастельний колір і порядок
// відображення. Проста CRUD-сутність на користувача (без синхронізації з календарем).
public class Note
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string Text { get; set; } = "";
    public string Color { get; set; } = "#fff3b0"; // HEX, колір картки
    public int Position { get; set; }               // порядок (менше = раніше)
}
