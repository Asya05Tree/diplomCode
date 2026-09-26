using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Text.RegularExpressions;
using Server.Data;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

public record SendCodeRequest(string Email, string Nickname);
public record RegisterRequest(string Nickname, string Gender, string Email, string Code, string Password);
public record LoginRequest(string Email, string Password);

// Реєстрація email+код підтвердження та вхід email+пароль (coding-guide.md §4).
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const int CodeLifetimeMinutes = 10;

    // Лише українські або англійські літери (та пробіл/дефіс/апостроф для складених імен)
    private static readonly Regex NicknamePattern = new(@"^[A-Za-zА-ЯҐЄІЇа-яґєіїʼ' -]{2,30}$", RegexOptions.Compiled);

    private readonly AppDbContext _db;
    private readonly EmailService _emailService;
    private readonly JwtService _jwtService;

    public AuthController(AppDbContext db, EmailService emailService, JwtService jwtService)
    {
        _db = db;
        _emailService = emailService;
        _jwtService = jwtService;
    }

    private static bool IsGmailAddress(string email) => email.EndsWith("@gmail.com", StringComparison.OrdinalIgnoreCase);

    [HttpPost("send-code")]
    public async Task<IActionResult> SendCode([FromBody] SendCodeRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !IsGmailAddress(email))
            return BadRequest(new { error = "invalid_email" });

        if (!string.IsNullOrWhiteSpace(request.Nickname) && !NicknamePattern.IsMatch(request.Nickname))
            return BadRequest(new { error = "invalid_nickname" });

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return BadRequest(new { error = "email_taken" });

        var code = Random.Shared.Next(0, 1_000_000).ToString("D6");
        _db.EmailVerificationCodes.Add(new EmailVerificationCode
        {
            Email = email,
            Code = code,
            ExpiresAt = DateTime.UtcNow.AddMinutes(CodeLifetimeMinutes),
        });
        await _db.SaveChangesAsync();

        await _emailService.SendVerificationCodeAsync(email, code, request.Nickname, CodeLifetimeMinutes);
        return Ok();
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (!IsGmailAddress(email))
            return BadRequest(new { error = "invalid_email" });

        if (string.IsNullOrWhiteSpace(request.Nickname) || !NicknamePattern.IsMatch(request.Nickname))
            return BadRequest(new { error = "invalid_nickname" });

        if (string.IsNullOrWhiteSpace(request.Gender) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "missing_fields" });

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return BadRequest(new { error = "email_taken" });

        var codeEntry = await _db.EmailVerificationCodes
            .Where(c => c.Email == email && c.Code == request.Code && !c.IsUsed && c.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(c => c.Id)
            .FirstOrDefaultAsync();
        if (codeEntry is null)
            return BadRequest(new { error = "invalid_code" });
        codeEntry.IsUsed = true;

        var user = new User
        {
            Nickname = request.Nickname,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsEmailConfirmed = true,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        _db.UserProfiles.Add(new UserProfile { UserId = user.Id, Gender = request.Gender });
        await _db.SaveChangesAsync();

        var token = _jwtService.CreateToken(user.Id, user.Email);
        return Ok(new { token, nickname = user.Nickname, email = user.Email });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return BadRequest(new { error = "invalid_credentials" });

        var token = _jwtService.CreateToken(user.Id, user.Email);
        return Ok(new { token, nickname = user.Nickname, email = user.Email });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new { nickname = user.Nickname, email = user.Email });
    }
}
