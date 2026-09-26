using System.Net;
using System.Net.Mail;

namespace Server.Services;

// Відправка коду підтвердження email (coding-guide.md §4).
// Якщо Smtp:Host не заповнений в конфізі — код просто пишеться в лог сервера,
// щоб реєстрацію можна було тестувати без реального поштового акаунта.
// Коли буде готовий Gmail App Password — досить заповнити Smtp:* в appsettings, код змінювати не треба.
public class EmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendVerificationCodeAsync(string email, string code, string nickname, int expiresInMinutes)
    {
        var host = _config["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogInformation("[DEV] Smtp:Host не налаштовано. Код підтвердження для {Email}: {Code}", email, code);
            return;
        }

        var port = int.Parse(_config["Smtp:Port"] ?? "587");
        var user = _config["Smtp:User"];
        var password = _config["Smtp:Password"];
        var from = _config["Smtp:From"] ?? user;

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(user, password),
        };

        using var message = new MailMessage(from!, email)
        {
            Subject = "Код автентифікації для Всетута",
            Body = BuildHtmlBody(nickname, code, expiresInMinutes),
            IsBodyHtml = true,
        };

        await client.SendMailAsync(message);
    }

    // Код виводиться звичайним текстом (не картинкою) — тільки так його можна виділити
    // й вставити в поля коду на сайті одним Ctrl+C/Ctrl+V.
    private static string BuildHtmlBody(string nickname, string code, int expiresInMinutes)
    {
        var greetingName = string.IsNullOrWhiteSpace(nickname) ? "користувачу" : nickname;

        return $"""
            <div style="font-family: Arial, sans-serif; text-align: center; max-width: 480px; margin: 0 auto; padding: 24px; color: #2b2b2b;">
                <p style="font-size: 16px; line-height: 1.5;">
                    Дорогий {greetingName},<br />
                    будь ласка, <strong>підтвердіть свою реєстрацію</strong>.
                </p>

                <div style="display: inline-block; margin: 24px 0; padding: 20px 32px; border: 2px solid #8fb8de; border-radius: 16px;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #7a7a7a;">Ваш код автентифікації для Всетута</p>
                    <p style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">{code}</p>
                </div>

                <p style="font-size: 14px; line-height: 1.5;">
                    Цей код дійсний протягом {expiresInMinutes} хвилин і може бути використаний лише один раз.
                </p>
                <p style="font-size: 13px; color: #7a7a7a; line-height: 1.5;">
                    Будь ласка, нікому не повідомляйте цей код: ми ніколи не будемо запитувати його по телефону чи електронною поштою.
                </p>

                <p style="font-size: 14px; margin-top: 24px;">
                    Дякуємо,<br />
                    Команда Всетута
                </p>
            </div>
            """;
    }
}
