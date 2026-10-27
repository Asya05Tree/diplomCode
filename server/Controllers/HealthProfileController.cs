using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using Server.Data;
using Server.Models;

namespace Server.Controllers;

public record UpdateHealthProfileRequest(double? Height, double? Weight, int? BirthYear, string? Gender);
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

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var profile = await _db.UserProfiles.FindAsync(CurrentUserId);
        if (profile is null) return NotFound();
        return Ok(new { profile.Height, profile.Weight, profile.BirthYear, profile.Gender });
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateHealthProfileRequest request)
    {
        var profile = await _db.UserProfiles.FindAsync(CurrentUserId);
        if (profile is null) return NotFound();

        profile.Height = request.Height;
        profile.Weight = request.Weight;
        profile.BirthYear = request.BirthYear;
        if (!string.IsNullOrWhiteSpace(request.Gender)) profile.Gender = request.Gender;
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
