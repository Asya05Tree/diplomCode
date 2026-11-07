using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

public record NoteRequest(string Text, string Color);

// Нотатки-«квадратики»: короткий текст з обмеженою довжиною. Проста CRUD прямо на DbContext
// (coding-guide.md §3: без репозиторіїв), без синхронізації з календарем.
[ApiController]
[Route("api/notes")]
[Authorize]
public class NotesController : ControllerBase
{
    private const int MaxTextLength = 280; // обмежена кількість тексту в одній нотатці

    private readonly AppDbContext _db;

    public NotesController(AppDbContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    public record NoteDto(int Id, string Text, string Color, int Position);

    [HttpGet]
    public async Task<IActionResult> Get() =>
        Ok(await _db.Notes
            .Where(n => n.UserId == CurrentUserId)
            .OrderBy(n => n.Position).ThenBy(n => n.Id)
            .Select(n => new NoteDto(n.Id, n.Text, n.Color, n.Position))
            .ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] NoteRequest r)
    {
        var userId = CurrentUserId;
        Limits.Ensure(await _db.Notes.CountAsync(n => n.UserId == userId), Limits.Notes, "notes");
        var maxPos = await _db.Notes.Where(n => n.UserId == userId).Select(n => (int?)n.Position).MaxAsync() ?? -1;
        var note = new Note
        {
            UserId = CurrentUserId,
            Text = Clamp(r.Text),
            Color = string.IsNullOrWhiteSpace(r.Color) ? "#fff3b0" : r.Color.Trim(),
            Position = maxPos + 1,
            UpdatedAt = DateTime.UtcNow,
        };
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();
        return Ok(new { id = note.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] NoteRequest r)
    {
        var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == CurrentUserId);
        if (note is null) return NotFound();
        note.Text = Clamp(r.Text);
        if (!string.IsNullOrWhiteSpace(r.Color)) note.Color = r.Color.Trim();
        note.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == CurrentUserId);
        if (note is null) return NotFound();
        _db.Notes.Remove(note);
        await _db.SaveChangesAsync();
        return Ok();
    }

    private static string Clamp(string? text)
    {
        text = (text ?? "").Trim();
        return text.Length > MaxTextLength ? text[..MaxTextLength] : text;
    }
}
