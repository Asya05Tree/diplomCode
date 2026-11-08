using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

public record PasswordConfirmRequest(string Password);
public record UpdateProfileStatusRequest(string? Gender, string? StudentType, bool? IsWorking);

// Керування акаунтом: експорт усіх даних у JSON, видалення всіх даних (акаунт лишається) та
// повне видалення акаунта. Видалення потребують повторного вводу пароля (захист від випадкового
// чи чужого видалення). Уся логіка — в AccountService.
[ApiController]
[Route("api/account")]
[Authorize]
public class AccountController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AccountService _account;

    public AccountController(AppDbContext db, AccountService account)
    {
        _db = db;
        _account = account;
    }

    private int CurrentUserId => User.GetUserId();

    // Контрольований шлях для полів профілю, що керують доступом до модулів (стать → Цикл,
    // статус навчання → Навчання, робота → Робота). Винесено з /api/health-profile, щоб «здоровʼя»
    // не могло самовільно розблоковувати модулі (mass-assignment). Оновлення ЧАСТКОВЕ: змінюються лише
    // передані поля, зріст/вага/рік народження НЕ зачіпаються (інакше зміна статі обнуляла б їх).
    [HttpPut("profile-status")]
    public async Task<IActionResult> UpdateProfileStatus([FromBody] UpdateProfileStatusRequest request)
    {
        // Приймаємо лише відомі значення — жодних довільних рядків (стать читає гейтинг Циклу).
        if (request.Gender is not null && request.Gender is not ("female" or "male" or "other"))
            return BadRequest(new { error = "invalid_gender" });
        if (request.StudentType is not null && request.StudentType is not ("pupil" or "student" or "none"))
            return BadRequest(new { error = "invalid_student_type" });

        var profile = await _db.UserProfiles.FindAsync(CurrentUserId);
        if (profile is null)
        {
            profile = new UserProfile { UserId = CurrentUserId };
            _db.UserProfiles.Add(profile);
        }

        if (request.Gender is not null) profile.Gender = request.Gender;
        if (request.StudentType is not null) profile.StudentType = request.StudentType;
        if (request.IsWorking is bool working) profile.IsWorking = working;
        await _db.SaveChangesAsync();
        return Ok();
    }

    // Окрема явна згода на обробку особливої категорії даних — здоров'я/цикл (ЗУ №2297-VI ст.7).
    // Викликається з екрана згоди перед першим відкриттям цих модулів. Ідемпотентна: повторний виклик
    // лишає найпершу дату згоди. Скасувати згоду користувач може, видаливши дані цих модулів.
    [HttpPost("health-consent")]
    public async Task<IActionResult> GiveHealthConsent()
    {
        var profile = await _db.UserProfiles.FindAsync(CurrentUserId);
        if (profile is null)
        {
            profile = new UserProfile { UserId = CurrentUserId };
            _db.UserProfiles.Add(profile);
        }
        profile.HealthConsentAt ??= DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok();
    }

    // Експорт усіх даних користувача — файл JSON на пристрій
    [HttpGet("export")]
    public async Task<IActionResult> Export()
    {
        var data = await _account.ExportAsync(CurrentUserId);
        if (data is null) return NotFound();

        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping, // кирилиця без \uXXXX
        };
        var bytes = JsonSerializer.SerializeToUtf8Bytes(data, options);
        var fileName = $"vsetut-export-{DateTime.UtcNow:yyyy-MM-dd}.json";
        return File(bytes, "application/json", fileName);
    }

    // Видалити ВСІ дані, але лишити акаунт (профіль і налаштування зберігаються)
    [HttpPost("wipe")]
    public async Task<IActionResult> WipeData([FromBody] PasswordConfirmRequest r)
    {
        if (!await VerifyPasswordAsync(r.Password)) return BadRequest(new { error = "invalid_credentials" });
        await _account.WipeContentAsync(CurrentUserId);
        return Ok();
    }

    // Повне видалення акаунта (спершу всі дані, потім сам акаунт)
    [HttpPost("delete")]
    public async Task<IActionResult> DeleteAccount([FromBody] PasswordConfirmRequest r)
    {
        if (!await VerifyPasswordAsync(r.Password)) return BadRequest(new { error = "invalid_credentials" });
        var ok = await _account.DeleteAccountAsync(CurrentUserId);
        return ok ? Ok() : NotFound();
    }

    private async Task<bool> VerifyPasswordAsync(string? password)
    {
        if (string.IsNullOrEmpty(password)) return false;
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == CurrentUserId);
        return user is not null && BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
    }
}
