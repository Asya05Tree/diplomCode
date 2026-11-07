using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

// Лише естетичні поля. Стать/статус навчання/роботи сюди НЕ входять: вони керують доступом до
// модулів (гейтинг), тож змінюються окремим контрольованим ендпойнтом (PUT /api/account/profile-status).
// Інакше був би mass-assignment: через «здоровʼя» юзер сам розблоковував би Навчання/Роботу/Цикл.
public record UpdateHealthProfileRequest(double? Height, double? Weight, int? BirthYear);
public record PutRestrictionRequest(string TagKey, string Relation, int? Weight); // Forbidden | Avoid | Prefer

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

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateHealthProfileRequest request)
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
        profile.Height = request.Height is double h ? Math.Clamp(h, 30, 300) : null;
        profile.Weight = request.Weight is double w ? Math.Clamp(w, 1, 500) : null;
        profile.BirthYear = request.BirthYear is int by ? Math.Clamp(by, nowYear - 120, nowYear - 1) : null;
        await _db.SaveChangesAsync();
        return Ok();
    }

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
