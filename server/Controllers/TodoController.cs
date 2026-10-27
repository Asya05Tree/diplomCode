using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

public record AddTodoRequest(string Text);
public record MoveTodoRequest(string Status, int OrderIndex); // todo | doing | done

// Проста дошка задач (три колонки todo/doing/done). Окремо від TaskItem — канбан без дат і
// повторень, тому це прямий CRUD без сервісу (працюємо з AppDbContext).
[ApiController]
[Route("api/todo")]
[Authorize]
public class TodoController : ControllerBase
{
    private static readonly string[] Statuses = { "todo", "doing", "done" };

    private readonly AppDbContext _db;

    public TodoController(AppDbContext db)
    {
        _db = db;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var items = await _db.TodoItems.Where(x => x.UserId == CurrentUserId).ToListAsync();
        // Статуси сортуємо в логічному порядку колонок (todo→doing→done), а не за абеткою
        var ordered = items
            .OrderBy(x => Array.IndexOf(Statuses, x.Status)).ThenBy(x => x.OrderIndex)
            .Select(x => new { x.Id, x.Text, x.Status, x.OrderIndex })
            .ToList();
        return Ok(ordered);
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddTodoRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Text)) return BadRequest(new { error = "missing_text" });

        // Нова картка стає в кінець колонки "todo"
        var maxIndex = await _db.TodoItems
            .Where(x => x.UserId == CurrentUserId && x.Status == "todo")
            .MaxAsync(x => (int?)x.OrderIndex) ?? -1;

        var item = new TodoItem { UserId = CurrentUserId, Text = request.Text.Trim(), Status = "todo", OrderIndex = maxIndex + 1 };
        _db.TodoItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(new { item.Id });
    }

    [HttpPut("{id}/move")]
    public async Task<IActionResult> Move(int id, [FromBody] MoveTodoRequest request)
    {
        if (!Statuses.Contains(request.Status)) return BadRequest(new { error = "invalid_status" });

        var item = await _db.TodoItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
        if (item is null) return NotFound();

        item.Status = request.Status;
        item.OrderIndex = request.OrderIndex;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.TodoItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
        if (item is null) return NotFound();
        _db.TodoItems.Remove(item);
        await _db.SaveChangesAsync();
        return Ok();
    }
}
