using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using Server.Data;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

// [StringLength] на текстових полях → 400 на завеликому рядку (обхід клієнтського maxLength) — ПЛАН P2-2.
public record AddMediaRequest([StringLength(TextLimits.Code)] string Kind,
    [StringLength(TextLimits.Title)] string Title, [StringLength(TextLimits.Name)] string? Author,
    [StringLength(TextLimits.Name)] string? Genre, [StringLength(TextLimits.Code)] string? MediaType,
    bool IsLibrary = false, DateTime? ReturnDeadline = null);
public record ScheduleMediaRequest(DateTime StartDateTime, int? DurationMinutes,
    [StringLength(TextLimits.Name)] string? Genre, [StringLength(TextLimits.Code)] string? MediaType);
public record SetMediaStatusRequest([StringLength(TextLimits.Code)] string Status, int? RatingStars,
    [StringLength(TextLimits.Description)] string? Review);
public record UpdateMediaRequest([StringLength(TextLimits.Title)] string Title,
    [StringLength(TextLimits.Name)] string? Author, int? RatingStars,
    [StringLength(TextLimits.Description)] string? Review, [StringLength(TextLimits.Name)] string? Genre,
    [StringLength(TextLimits.Code)] string? MediaType,
    bool IsLibrary = false, DateTime? ReturnDeadline = null, DateTime? StartDateTime = null);
// Чекбокс "повернено" (true) або його зняття в налаштуваннях картки (false).
public record ReturnMediaRequest(bool Returned);

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

    // Дозволені ключі класифікації — дзеркало client/src/utils/watchlistTaxonomy.js.
    // Невідомий ключ трактуємо як null (не зберігаємо «сміття» навіть в обхід UI).
    private static readonly HashSet<string> VideoTypes =
        new() { "film", "series", "anime", "dorama", "cartoon", "other" };
    private static readonly HashSet<string> VideoGenres =
        new() { "drama", "comedy", "action", "scifi", "fantasy", "horror", "thriller", "melodrama", "detective", "adventure", "documentary", "other" };
    private static readonly HashSet<string> BookGenres =
        new() { "fiction", "nonfiction", "scifi", "fantasy", "detective", "melodrama", "thriller", "poetry", "biography", "selfdev", "history", "other" };

    private readonly AppDbContext _db;
    private readonly TaskService _tasks;

    public MediaController(AppDbContext db, TaskService tasks)
    {
        _db = db;
        _tasks = tasks;
    }

    private int CurrentUserId => User.GetUserId();

    private static string? Clean(string? text, int max)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var t = text.Trim();
        return t.Length > max ? t[..max] : t;
    }

    // Жанр — з довідника за типом (video|book); невідоме → null.
    private static string? CleanGenre(string kind, string? genre)
    {
        if (string.IsNullOrWhiteSpace(genre)) return null;
        var g = genre.Trim();
        var set = kind == "book" ? BookGenres : VideoGenres;
        return set.Contains(g) ? g : null;
    }

    // Вид — лише для відео; невідоме → null.
    private static string? CleanType(string kind, string? type)
    {
        if (kind != "video" || string.IsNullOrWhiteSpace(type)) return null;
        var t = type.Trim();
        return VideoTypes.Contains(t) ? t : null;
    }

    // Борг — обчислюється, не зберігається: бібліотечна, не повернена, дедлайн минув, ще не завершена.
    // Завершені («done») у борги не потрапляють — читач уже впорався, лишилося тільки повернути.
    private static bool IsDebt(MediaItem x) =>
        x.IsLibrary && !x.IsReturned && x.ReturnDeadline.HasValue
        && x.ReturnDeadline.Value.Date < DateTime.Today && x.Status != "done";

    private static object ToDto(MediaItem x) => new
    {
        x.Id, x.Kind, x.Title, x.Author, x.Status, x.Genre, x.MediaType, x.StartDate, x.RatingStars, x.Review, x.TaskId,
        x.IsLibrary, x.ReturnDeadline, x.IsReturned, IsDebt = IsDebt(x),
    };

    // Видалити подію-нагадування про повернення з календаря (якщо є) і забути її Id.
    private async Task RemoveReturnTaskAsync(MediaItem item)
    {
        if (item.ReturnTaskId.HasValue)
        {
            await _tasks.DeleteTaskAsync(CurrentUserId, item.ReturnTaskId.Value, cascadeSource: false);
            item.ReturnTaskId = null;
        }
    }

    // Синхронізувати подію-нагадування зі станом книги. Потрібна лише бібліотечній, не поверненій
    // книзі з дедлайном. SourceModule="media_return" (НЕ "media"), щоб видалення події в календарі
    // не чіпало сам запис книги (каскад у TaskService реагує тільки на "media").
    private async Task SyncReturnTaskAsync(MediaItem item)
    {
        var needTask = item.IsLibrary && item.ReturnDeadline.HasValue && !item.IsReturned;
        if (!needTask)
        {
            await RemoveReturnTaskAsync(item);
            return;
        }

        var title = "Повернути книгу: " + item.Title;
        if (item.ReturnTaskId.HasValue)
        {
            // Оновлюємо наявну подію; якщо її видалили вручну в календарі — створимо нову нижче.
            var ok = await _tasks.UpdateTaskAsync(CurrentUserId, item.ReturnTaskId.Value, title, item.Author, item.ReturnDeadline, null, null);
            if (!ok) item.ReturnTaskId = null;
        }
        if (!item.ReturnTaskId.HasValue)
        {
            var task = await _tasks.CreateTaskAsync(CurrentUserId, title, item.Author, item.ReturnDeadline, null, null,
                moduleCode: "media", sourceModule: "media_return", sourceEntityId: item.Id);
            item.ReturnTaskId = task.Id;
        }
    }

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

        Limits.Ensure(await _db.MediaItems.CountAsync(x => x.UserId == CurrentUserId), Limits.MediaItems, "media_items");

        var item = new MediaItem
        {
            UserId = CurrentUserId,
            Kind = kind,
            Title = title,
            Author = kind == "book" ? Clean(request.Author, AuthorMax) : null,
            Genre = CleanGenre(kind, request.Genre),
            MediaType = CleanType(kind, request.MediaType),
            Status = "planned",
            // Бібліотечні/позичені поля — лише для книг
            IsLibrary = kind == "book" && request.IsLibrary,
            ReturnDeadline = kind == "book" && request.IsLibrary ? request.ReturnDeadline : null,
        };
        _db.MediaItems.Add(item);
        await _db.SaveChangesAsync();           // спершу Id — потрібен для SourceEntityId події
        await SyncReturnTaskAsync(item);        // створить нагадування про повернення, якщо бібліотечна з дедлайном
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

        // Вид/жанр можна доввести саме під час планування (поле необовʼязкове в "У планах").
        var g = CleanGenre(item.Kind, request.Genre);
        if (g != null) item.Genre = g;
        var mt = CleanType(item.Kind, request.MediaType);
        if (mt != null) item.MediaType = mt;

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
            // Рейтинг і відгук — для обох типів.
            item.RatingStars = request.RatingStars.HasValue
                ? Math.Clamp(request.RatingStars.Value, 1, 5)
                : (int?)null;
            item.Review = Clean(request.Review, ReviewMax);
            // Повʼязана подія календаря стає завершеною: у календарі її можна лише видалити
            // (а видалення там прибере й цей запис).
            if (item.TaskId.HasValue)
            {
                var task = await _db.Tasks.FirstOrDefaultAsync(x => x.Id == item.TaskId.Value && x.UserId == CurrentUserId);
                if (task is not null) task.Status = "Done";
            }
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
        item.RatingStars = request.RatingStars.HasValue
            ? Math.Clamp(request.RatingStars.Value, 1, 5)
            : (int?)null;
        // Клієнт завжди надсилає поточні вид/жанр, тож перезапис безпечний (не затирає класифікацію).
        item.Genre = CleanGenre(item.Kind, request.Genre);
        item.MediaType = CleanType(item.Kind, request.MediaType);

        // Бібліотечні поля — лише для книг. Зміна дедлайну/прапорця синхронізує подію-нагадування.
        if (item.Kind == "book")
        {
            item.IsLibrary = request.IsLibrary;
            item.ReturnDeadline = request.IsLibrary ? request.ReturnDeadline : null;
            await SyncReturnTaskAsync(item);
        }

        // Перепланування (для вже запланованих): змінюємо дату/час повʼязаної події перегляду/читання.
        if (request.StartDateTime.HasValue && item.TaskId.HasValue)
        {
            var taskTitle = (item.Kind == "video" ? "Подивитися: " : "Прочитати: ") + item.Title;
            await _tasks.UpdateTaskAsync(CurrentUserId, item.TaskId.Value, taskTitle, item.Author, request.StartDateTime, null, null);
            item.StartDate = request.StartDateTime;
        }

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

        // cascadeSource:false — цей запис прибираємо тут самі, інакше буде подвійне видалення
        if (item.TaskId.HasValue) await _tasks.DeleteTaskAsync(CurrentUserId, item.TaskId.Value, cascadeSource: false);
        await RemoveReturnTaskAsync(item);
        _db.MediaItems.Remove(item);
        await _db.SaveChangesAsync();
        return Ok();
    }

    // Чекбокс «повернено» для бібліотечної/позиченої книги. Переміщення між вкладками залежить
    // від стану книги на момент дії (§2.4 плану):
    //   planned (і не борг) → книгу не читали → видаляємо;
    //   in_progress / борг   → у «Завершено» (запамʼятовуємо попередній статус для реактивації);
    //   done                 → лишається в «Завершено».
    // Зняття галочки (Returned=false) — реактивація: відновлюємо попередній статус і подію-нагадування.
    [HttpPut("{id}/return")]
    public async Task<IActionResult> SetReturned(int id, [FromBody] ReturnMediaRequest request)
    {
        var item = await _db.MediaItems.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
        if (item is null) return NotFound();
        if (!item.IsLibrary) return BadRequest(new { error = "not_library" });

        if (request.Returned)
        {
            if (item.IsReturned) return Ok(ToDto(item));

            var wasDebt = IsDebt(item);
            await RemoveReturnTaskAsync(item); // борг закрито — нагадування більше не потрібне

            // «У планах» і не борг — книгу так і не почали читати: прибираємо повністю
            if (!wasDebt && item.Status == "planned")
            {
                if (item.TaskId.HasValue) await _tasks.DeleteTaskAsync(CurrentUserId, item.TaskId.Value, cascadeSource: false);
                _db.MediaItems.Remove(item);
                await _db.SaveChangesAsync();
                return Ok(new { deleted = true });
            }

            item.StatusBeforeReturn = item.Status;   // для коректної реактивації
            if (item.Status != "done") item.Status = "done";
            item.IsReturned = true;
        }
        else
        {
            if (!item.IsReturned) return Ok(ToDto(item));
            // Реактивація: назад у попередній статус; далі книга сама опиниться в «Боргах»
            // (якщо дедлайн минув) або у своїй вкладці — борг обчислюваний.
            item.Status = item.StatusBeforeReturn ?? item.Status;
            item.StatusBeforeReturn = null;
            item.IsReturned = false;
            await SyncReturnTaskAsync(item);         // відновити нагадування, якщо є дедлайн
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(item));
    }
}
