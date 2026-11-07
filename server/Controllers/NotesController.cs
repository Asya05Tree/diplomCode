using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

// [StringLength] на Text → 400 на завеликому рядку (раніше текст мовчки обрізався до 280 — ПЛАН P2-2).
public record NoteRequest([StringLength(TextLimits.Note)] string Text,
    [StringLength(TextLimits.Color)] string Color);

// Нотатки-«квадратики»: короткий текст з обмеженою довжиною. Проста CRUD прямо на DbContext
// (coding-guide.md §3: без репозиторіїв), без синхронізації з календарем.
[ApiController]
[Route("api/notes")]
[Authorize]
public class NotesController : ControllerBase
{
    private const int MaxTextLength = 280; // обмежена кількість тексту в одній нотатці
    private const string DefaultColor = "#fff3b0";

    // Колір зберігається лише як hex (#RGB або #RRGGBB). Інакше довільний рядок (напр.
    // "url(https://evil/..)") доїжджав би у style={{background}} на клієнті й тягнув би зовнішній
    // ресурс при рендері (CSS-ін'єкція/beacon). Hex-формат заразом обмежує довжину поля (ПЛАН P2-4).
    private static readonly Regex HexColor = new("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$", RegexOptions.Compiled);

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
            Color = NormalizeColor(r.Color),
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
        if (!string.IsNullOrWhiteSpace(r.Color)) note.Color = NormalizeColor(r.Color);
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

    // Порожньо → колір за замовчуванням; інакше має бути hex (#RGB/#RRGGBB), будь-що інше → 400.
    private static string NormalizeColor(string? color)
    {
        if (string.IsNullOrWhiteSpace(color)) return DefaultColor;
        var value = color.Trim();
        if (!HexColor.IsMatch(value)) throw new BadInputException("invalid_color");
        return value;
    }
}
