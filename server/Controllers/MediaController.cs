using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using Server.Data;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

public record AddMediaRequest(string Kind, string Title, string? Author);
public record ScheduleMediaRequest(DateTime StartDateTime, int? DurationMinutes);
public record SetMediaStatusRequest(string Status, int? RatingStars, string? Review);
public record UpdateMediaRequest(string Title, string? Author, int? RatingStars, string? Review);

// Список "що подивитися / що прочитати". Прямий CRUD через AppDbContext (як TodoController),
// але інжектимо TaskService, бо планування елемента створює подію в календарі.
// Статуси рухаються лише вперед: planned → in_progress → done (назад у planned — 400).
[ApiController]
[Route("api/media")]
[Authorize]
public class MediaController : ControllerBase
{
    private const int TitleMax = 120;
    private const int AuthorMax = 60;
    private const int ReviewMax = 200;
    private static readonly string[] Kinds = { "video", "book" };
    // Порядок станів — індекс у масиві задає напрям (вперед = більший індекс)
    private static readonly string[] StatusOrder = { "planned", "in_progress", "done" };

    private readonly AppDbContext _db;
    private readonly TaskService _tasks;

    public MediaController(AppDbContext db, TaskService tasks)
    {
        _db = db;
        _tasks = tasks;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    private static string? Clean(string? text, int max)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var t = text.Trim();
        return t.Length > max ? t[..max] : t;
    }

    private static object ToDto(MediaItem x) => new
    {
        x.Id, x.Kind, x.Title, x.Author, x.Status, x.StartDate, x.RatingStars, x.Review, x.TaskId,
    };

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var items = await _db.MediaItems
            .Where(x => x.UserId == CurrentUserId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
        return Ok(items.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddMediaRequest request)
    {
        var kind = (request.Kind ?? "").Trim().ToLowerInvariant();
        if (!Kinds.Contains(kind)) return BadRequest(new { error = "invalid_kind" });
        var title = Clean(request.Title, TitleMax);
        if (title is null) return BadRequest(new { error = "missing_title" });

        var item = new MediaItem
        {
            UserId = CurrentUserId,
            Kind = kind,
            Title = title,
            Author = kind == "book" ? Clean(request.Author, AuthorMax) : null,
            Status = "planned",
        };
        _db.MediaItems.Add(item);
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    // planned → in_progress: створюємо подію календаря й запамʼятовуємо її Id.
    [HttpPost("{id}/schedule")]
    public async Task<IActionResult> Schedule(int id, [FromBody] ScheduleMediaRequest request)
    {
        var item = await _db.MediaItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
        if (item is null) return NotFound();
        if (item.Status != "planned") return BadRequest(new { error = "already_scheduled" });

        var duration = request.DurationMinutes.HasValue
            ? Math.Clamp(request.DurationMinutes.Value, 1, 1440)
            : (int?)null;
        var taskTitle = (item.Kind == "video" ? "Подивитися: " : "Прочитати: ") + item.Title;

        var task = await _tasks.CreateTaskAsync(
            CurrentUserId, taskTitle, item.Author, request.StartDateTime, duration, null,
            moduleCode: "media", sourceModule: "media", sourceEntityId: item.Id);

        item.TaskId = task.Id;
        item.StartDate = request.StartDateTime;
        item.Status = "in_progress";
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    // Зміна статусу — лише вперед. На практиці сюди приходить перехід у "done"
    // (у "in_progress" потрапляють через /schedule, бо потрібна дата й подія календаря).
    [HttpPut("{id}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] SetMediaStatusRequest request)
    {
        var target = (request.Status ?? "").Trim();
        var targetIdx = Array.IndexOf(StatusOrder, target);
        if (targetIdx < 0) return BadRequest(new { error = "invalid_status" });

        var item = await _db.MediaItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
        if (item is null) return NotFound();

        var currentIdx = Array.IndexOf(StatusOrder, item.Status);
        // Тільки вперед: назад у planned (чи будь-який крок назад) заборонено
        if (targetIdx <= currentIdx) return BadRequest(new { error = "backward_not_allowed" });
        // У "in_progress" — лише через /schedule (інакше не було б дати/події календаря)
        if (target == "in_progress") return BadRequest(new { error = "use_schedule" });

        item.Status = target;
        if (target == "done")
        {
            // Рейтинг — лише для книг; відгук — для обох. Подію календаря не чіпаємо (дата лишається).
            item.RatingStars = item.Kind == "book" && request.RatingStars.HasValue
                ? Math.Clamp(request.RatingStars.Value, 1, 5)
                : (int?)null;
            item.Review = Clean(request.Review, ReviewMax);
        }
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    // Редагування полів (назва/автор/відгук/рейтинг) у межах тих самих правил валідації.
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMediaRequest request)
    {
        var item = await _db.MediaItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
        if (item is null) return NotFound();

        var title = Clean(request.Title, TitleMax);
        if (title is null) return BadRequest(new { error = "missing_title" });

        item.Title = title;
        item.Author = item.Kind == "book" ? Clean(request.Author, AuthorMax) : null;
        item.Review = Clean(request.Review, ReviewMax);
        item.RatingStars = item.Kind == "book" && request.RatingStars.HasValue
            ? Math.Clamp(request.RatingStars.Value, 1, 5)
            : (int?)null;
        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }

    // Явне видалення: прибираємо й повʼязану подію календаря, якщо вона є.
    // (Перехід у "done" нічого не видаляє — лише ручне видалення.)
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.MediaItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
        if (item is null) return NotFound();

        if (item.TaskId.HasValue) await _tasks.DeleteTaskAsync(CurrentUserId, item.TaskId.Value);
        _db.MediaItems.Remove(item);
        await _db.SaveChangesAsync();
        return Ok();
    }
}
