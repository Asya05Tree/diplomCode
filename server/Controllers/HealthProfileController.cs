using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

// [StringLength] на TagKey: без межі тег спамив би глобальну таблицю Tags гігантськими ключами (ПЛАН P2-2).
public record PutRestrictionRequest([StringLength(TextLimits.Code)] string TagKey, string Relation, int? Weight); // Forbidden | Avoid | Prefer

// planner-spec.md §3.1/§3.2. Профіль здоровʼя: естетичні поля (зріст/вага/рік/стать) + обмеження
// користувача (UserTagPreference). Обмеження — ті самі дані, що читає рушій правил "Їжі", тому
// керування ними зібране тут. Окремого сервісу не потрібно — це прямий CRUD, працюємо з AppDbContext.
[ApiController]
[Route("api/health-profile")]
[Authorize]
public class HealthProfileController : ControllerBase
{
    private readonly AppDbContext _db;

    public HealthProfileController(AppDbContext db)
    {
        _db = db;
    }

    private int CurrentUserId => User.GetUserId();

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var profile = await _db.UserProfiles.FindAsync(CurrentUserId);
        if (profile is null) return NotFound();
        return Ok(new { profile.Height, profile.Weight, profile.BirthYear, profile.Gender, profile.StudentType, profile.IsWorking });
    }

    // Лише естетичні поля (зріст/вага/рік народження). Стать/статус навчання/роботи сюди НЕ входять:
    // вони керують доступом до модулів (гейтинг), тож змінюються окремим контрольованим ендпойнтом
    // (PUT /api/account/profile-status) — інакше через «здоровʼя» юзер сам розблоковував би модулі.
    //
    // Тіло читаємо як JsonElement, щоб зробити ЧАСТКОВЕ оновлення: чіпаємо лише поля, ПРИСУТНІ у запиті.
    // Відсутнє поле лишаємо без змін (явний null — очищення). Інакше зміна одного параметра мовчки
    // обнуляла б решту (напр. колишній перемикач статі стирав зріст/вагу/рік) — spec §3.1.
    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] JsonElement body)
    {
        // Upsert: зазвичай профіль створюється при реєстрації, але якщо його чомусь немає —
        // заводимо, щоб збереження параметрів ніколи не падало (NotFound).
        var profile = await _db.UserProfiles.FindAsync(CurrentUserId);
        if (profile is null)
        {
            profile = new UserProfile { UserId = CurrentUserId };
            _db.UserProfiles.Add(profile);
        }

        // Реалістичні межі (захист БД навіть в обхід UI): зріст 30–300 см, вага 1–500 кг, вік 1–120 років.
        var nowYear = DateTime.Now.Year;
        if (TryProp(body, "height", out var hEl)) profile.Height = ClampNullable(hEl, 30, 300);
        if (TryProp(body, "weight", out var wEl)) profile.Weight = ClampNullable(wEl, 1, 500);
        if (TryProp(body, "birthYear", out var byEl))
            profile.BirthYear = ClampNullable(byEl, nowYear - 120, nowYear - 1) is double b ? (int)b : null;
        await _db.SaveChangesAsync();
        return Ok();
    }

    // Чи є у тілі (JSON-обʼєкті) властивість із такою назвою (без урахування регістру — клієнт шле camelCase).
    private static bool TryProp(JsonElement obj, string name, out JsonElement value)
    {
        value = default;
        if (obj.ValueKind != JsonValueKind.Object) return false;
        foreach (var p in obj.EnumerateObject())
            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) { value = p.Value; return true; }
        return false;
    }

    // Число → у межах [min,max]; явний null → null (очистити); інший тип → null (ігноруємо некоректне).
    private static double? ClampNullable(JsonElement el, double min, double max) =>
        el.ValueKind == JsonValueKind.Number ? Math.Clamp(el.GetDouble(), min, max) : null;

    [HttpGet("restrictions")]
    public async Task<IActionResult> GetRestrictions()
    {
        var restrictions = await _db.UserTagPreferences
            .Where(p => p.UserId == CurrentUserId)
            .Include(p => p.Tag)
            .Select(p => new { tagKey = p.Tag!.Key, relation = p.Relation, weight = p.Weight, displayName = p.Tag!.DisplayName })
            .ToListAsync();
        return Ok(restrictions);
    }

    [HttpPut("restrictions")]
    public async Task<IActionResult> PutRestriction([FromBody] PutRestrictionRequest request)
    {
        if (request.Relation is not ("Forbidden" or "Avoid" or "Prefer"))
            return BadRequest(new { error = "invalid_relation" });
        if (string.IsNullOrWhiteSpace(request.TagKey))
            return BadRequest(new { error = "missing_tag" });

        // Обмеження задається за ключем тега; якщо такого тега ще немає — створюємо (алерген за замовчуванням)
        var key = request.TagKey.Trim().ToLowerInvariant();
        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Key == key);
        if (tag is null)
        {
            tag = new Tag { Namespace = "allergen", Key = key, DisplayName = request.TagKey.Trim() };
            _db.Tags.Add(tag);
            await _db.SaveChangesAsync();
        }

        var pref = await _db.UserTagPreferences.FirstOrDefaultAsync(p => p.UserId == CurrentUserId && p.TagId == tag.Id);
        if (pref is null)
        {
            pref = new UserTagPreference { UserId = CurrentUserId, TagId = tag.Id };
            _db.UserTagPreferences.Add(pref);
        }
        pref.Relation = request.Relation;
        pref.Weight = request.Relation == "Forbidden" ? null : request.Weight;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("restrictions/{tagKey}")]
    public async Task<IActionResult> DeleteRestriction(string tagKey)
    {
        var key = tagKey.Trim().ToLowerInvariant();
        var pref = await _db.UserTagPreferences
            .Include(p => p.Tag)
            .FirstOrDefaultAsync(p => p.UserId == CurrentUserId && p.Tag!.Key == key);
        if (pref is null) return NotFound();

        _db.UserTagPreferences.Remove(pref);
        await _db.SaveChangesAsync();
        return Ok();
    }
}
