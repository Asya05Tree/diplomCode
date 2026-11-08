using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Server.Data;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

// [StringLength] на текстових полях → 400 замість 500, коли прямий POST шле рядок, довший за стовпець
// БД (email/нік зберігаються як varchar(255)); клієнтська форма це не зачіпає (ПЛАН P2-2/P2-6).
public record SendCodeRequest([StringLength(254)] string Email, [StringLength(TextLimits.Name)] string Nickname);
public record RegisterRequest([StringLength(TextLimits.Name)] string Nickname, [StringLength(TextLimits.Code)] string Gender,
    [StringLength(254)] string Email, [StringLength(TextLimits.Code)] string Code, [StringLength(TextLimits.Description)] string Password,
    [StringLength(TextLimits.Code)] string? StudentType, bool IsWorking, bool ConsentAccepted);
public record LoginRequest([StringLength(254)] string Email, [StringLength(TextLimits.Description)] string Password);
public record ForgotPasswordRequest([StringLength(254)] string Email);
public record ResetPasswordRequest([StringLength(254)] string Email, [StringLength(TextLimits.Code)] string Code,
    [StringLength(TextLimits.Description)] string Password);

// Реєстрація email+код підтвердження та вхід email+пароль (coding-guide.md §4).
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const int CodeLifetimeMinutes = 10;

    // Лише українські або англійські літери (та пробіл/дефіс/апостроф для складених імен). Lookahead
    // вимагає хоча б одну літеру, щоб «--» чи «  » не вважалися іменем (ПЛАН P2-6).
    private static readonly Regex NicknamePattern =
        new(@"^(?=.*[A-Za-zА-ЯҐЄІЇа-яґєіїʼ])[A-Za-zА-ЯҐЄІЇа-яґєіїʼ' -]{2,30}$", RegexOptions.Compiled);

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

    // Канонічний вигляд email: lower-case; для gmail — прибираємо крапки та "+suffix" у локальній
    // частині (gmail їх ігнорує). Одна поштова скринька = один акаунт: інакше аліасами можна плодити
    // акаунти в обхід email_taken і квоти безкоштовних фіч (ПЛАН P2-6).
    private static string NormalizeEmail(string email)
    {
        var e = (email ?? "").Trim().ToLowerInvariant();
        var at = e.IndexOf('@');
        if (at <= 0) return e;
        var local = e[..at];
        var domain = e[(at + 1)..];
        if (domain is "gmail.com" or "googlemail.com")
        {
            var plus = local.IndexOf('+');
            if (plus >= 0) local = local[..plus];
            local = local.Replace(".", "");
        }
        return local + "@" + domain;
    }

    [HttpPost("send-code")]
    public async Task<IActionResult> SendCode([FromBody] SendCodeRequest request)
    {
        var email = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(email) || !IsGmailAddress(email) || email.StartsWith('@'))
            return BadRequest(new { error = "invalid_email" }); // StartsWith('@') → порожня локальна частина

        if (!string.IsNullOrWhiteSpace(request.Nickname) && !NicknamePattern.IsMatch(request.Nickname))
            return BadRequest(new { error = "invalid_nickname" });

        // Анти-енумерація: далі завжди 200, незалежно від того, існує email чи ні (інакше 400 email_taken
        // vs 200 видавав, у кого є акаунт). Код реально створюємо й шлемо лише коли email вільний і не було
        // коду за останні 60 с (кулдаун) — інакше тихо нічого не робимо (ПЛАН P2-6).
        var now = DateTime.UtcNow;
        var taken = await _db.Users.AnyAsync(u => u.Email == email);
        var recent = await _db.EmailVerificationCodes.AnyAsync(c => c.Email == email && c.CreatedAt > now.AddSeconds(-60));
        if (!taken && !recent)
        {
            // Один чинний код на email: гасимо попередні невикористані.
            await _db.EmailVerificationCodes
                .Where(c => c.Email == email && !c.IsUsed)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsUsed, true));

            var code = Random.Shared.Next(0, 1_000_000).ToString("D6");
            _db.EmailVerificationCodes.Add(new EmailVerificationCode
            {
                Email = email,
                Code = code,
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(CodeLifetimeMinutes),
            });
            await _db.SaveChangesAsync();

            await _emailService.SendVerificationCodeAsync(email, code, request.Nickname, CodeLifetimeMinutes);
        }
        return Ok();
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var email = NormalizeEmail(request.Email);
        if (!IsGmailAddress(email) || email.StartsWith('@'))
            return BadRequest(new { error = "invalid_email" });

        if (string.IsNullOrWhiteSpace(request.Nickname) || !NicknamePattern.IsMatch(request.Nickname))
            return BadRequest(new { error = "invalid_nickname" });

        if (string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "missing_fields" });

        // Згода на обробку персональних даних — обов'язкова правова підстава (ЗУ №2297-VI ст.6,11).
        // Клієнт не дає натиснути «Зареєструватися» без галочки; сервер підстраховує прямий POST.
        if (!request.ConsentAccepted)
            return BadRequest(new { error = "consent_required" });

        // Стать — лише з відомого набору (як studentType), щоб не зберігати сирий довільний рядок (ПЛАН P2-6).
        if (request.Gender is not ("female" or "male" or "other"))
            return BadRequest(new { error = "invalid_gender" });

        // bcrypt рахує 72 БАЙТИ (не символи) й мовчки обрізає решту: 36 кирилічних літер = 72 байти,
        // тож char-ліміт не закривав колізію усічення. Перевіряємо саме байти (ПЛАН P2-6).
        if (request.Password.Length < 6 || System.Text.Encoding.UTF8.GetByteCount(request.Password) > 72)
            return BadRequest(new { error = "invalid_password_length" });

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return BadRequest(new { error = "email_taken" });

        // Один чинний код на email (найновіший невикористаний непротермінований).
        var codeEntry = await _db.EmailVerificationCodes
            .Where(c => c.Email == email && !c.IsUsed && c.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(c => c.Id)
            .FirstOrDefaultAsync();
        if (codeEntry is null)
            return BadRequest(new { error = "invalid_code" });
        if (codeEntry.Code != request.Code)
        {
            // Невдала спроба: рахуємо; після 5 — спалюємо код (lockout проти брутфорсу коду, ПЛАН P2-6).
            codeEntry.Attempts++;
            if (codeEntry.Attempts >= 5) codeEntry.IsUsed = true;
            await _db.SaveChangesAsync();
            return BadRequest(new { error = "invalid_code" });
        }
        codeEntry.IsUsed = true;

        var user = new User
        {
            Nickname = request.Nickname,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsEmailConfirmed = true,
            PolicyAcceptedAt = DateTime.UtcNow, // зафіксувати факт і час згоди
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // StudentType керує виглядом розділу "Навчання"; приймаємо лише відомі значення
        var studentType = request.StudentType is "pupil" or "student" or "none" ? request.StudentType : null;
        _db.UserProfiles.Add(new UserProfile
        {
            UserId = user.Id,
            Gender = request.Gender,
            StudentType = studentType,
            IsWorking = request.IsWorking,
        });
        await _db.SaveChangesAsync();

        var token = _jwtService.CreateToken(user.Id, user.Email, user.TokenVersion);
        return Ok(new { token, nickname = user.Nickname, email = user.Email });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return BadRequest(new { error = "invalid_credentials" });

        var token = _jwtService.CreateToken(user.Id, user.Email, user.TokenVersion);
        return Ok(new { token, nickname = user.Nickname, email = user.Email });
    }

    // Відновлення пароля (бо «згадати» його інакше не можна, а скидати через БД — не варіант для
    // користувача). Той самий механізм email-коду, що й при реєстрації (EmailVerificationCode).
    // Крок 1: надіслати код на пошту акаунта. Анти-енумерація: завжди 200; код шлемо лише якщо
    // акаунт існує і не було коду за останні 60 с (кулдаун проти спаму).
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var email = NormalizeEmail(request.Email);
        if (string.IsNullOrWhiteSpace(email) || !IsGmailAddress(email) || email.StartsWith('@'))
            return BadRequest(new { error = "invalid_email" });

        var now = DateTime.UtcNow;
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        var recent = await _db.EmailVerificationCodes.AnyAsync(c => c.Email == email && c.CreatedAt > now.AddSeconds(-60));
        if (user is not null && !recent)
        {
            // Один чинний код на email: гасимо попередні невикористані.
            await _db.EmailVerificationCodes
                .Where(c => c.Email == email && !c.IsUsed)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsUsed, true));

            var code = Random.Shared.Next(0, 1_000_000).ToString("D6");
            _db.EmailVerificationCodes.Add(new EmailVerificationCode
            {
                Email = email,
                Code = code,
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(CodeLifetimeMinutes),
            });
            await _db.SaveChangesAsync();

            await _emailService.SendVerificationCodeAsync(email, code, user.Nickname, CodeLifetimeMinutes);
        }
        return Ok();
    }

    // Крок 2: перевірити код і встановити новий пароль. Та сама перевірка коду з lockout після 5 спроб,
    // що й у реєстрації. Після зміни пароля інкрементуємо TokenVersion — усі старі сесії відкликаються.
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Password)
            || request.Password.Length < 6
            || System.Text.Encoding.UTF8.GetByteCount(request.Password) > 72)
            return BadRequest(new { error = "invalid_password_length" });

        var email = NormalizeEmail(request.Email);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        var codeEntry = await _db.EmailVerificationCodes
            .Where(c => c.Email == email && !c.IsUsed && c.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(c => c.Id)
            .FirstOrDefaultAsync();
        // Не розкриваємо, існує акаунт чи ні: і неіснуючий акаунт, і відсутній код → той самий invalid_code.
        if (user is null || codeEntry is null)
            return BadRequest(new { error = "invalid_code" });
        if (codeEntry.Code != request.Code)
        {
            codeEntry.Attempts++;
            if (codeEntry.Attempts >= 5) codeEntry.IsUsed = true;
            await _db.SaveChangesAsync();
            return BadRequest(new { error = "invalid_code" });
        }
        codeEntry.IsUsed = true;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        user.TokenVersion++; // відкликати всі старі сесії після зміни пароля
        await _db.SaveChangesAsync();
        return Ok();
    }

    // Вийти: інкрементуємо версію токена в БД — усі раніше видані токени цього акаунта миттєво
    // перестають проходити валідацію (claim "tver" більше не збігається). Сервер не тримає чорний
    // список; це найпростіший спосіб серверного logout (ПЛАН P2-1).
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var userId = User.GetUserId();
        await _db.Users.Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1));
        return Ok();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = User.GetUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new { nickname = user.Nickname, email = user.Email });
    }
}
