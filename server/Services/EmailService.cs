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

    public Task SendVerificationCodeAsync(string email, string code, string nickname, int expiresInMinutes) =>
        SendAsync(email, "Код автентифікації для Всетута", BuildHtmlBody(nickname, code, expiresInMinutes),
            devLog: $"Код підтвердження для {email}: {code}");

    // Попередження про майбутнє автовидалення неактивного акаунта (ЗУ №2297-VI ст.8/12 — суб'єкт має
    // бути поінформований перед безповоротним видаленням). Надсилається за кілька тижнів до видалення.
    public Task SendAccountDeletionWarningAsync(string email, string nickname, int daysLeft) =>
        SendAsync(email, "Ваш акаунт у Всетуті скоро буде видалено", BuildDeletionWarningBody(nickname, daysLeft),
            devLog: $"Попередження про видалення акаунта {email}: лишилось ~{daysLeft} дн.");

    // Єдина точка відправки. Якщо Smtp:Host не заповнений — лист лише пишеться в лог сервера,
    // щоб усе працювало без реального поштового акаунта (dev).
    private async Task SendAsync(string email, string subject, string htmlBody, string devLog)
    {
        var host = _config["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogInformation("[DEV] Smtp:Host не налаштовано. {DevLog}", devLog);
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
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true,
        };

        await client.SendMailAsync(message);
    }

    private static string BuildDeletionWarningBody(string nickname, int daysLeft)
    {
        var greetingName = string.IsNullOrWhiteSpace(nickname) ? "користувачу" : nickname;
        return $"""
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2b2b2b; line-height: 1.5;">
                <p style="font-size: 16px;">Дорогий {greetingName},</p>
                <p style="font-size: 15px;">
                    ваш акаунт у <strong>Всетуті</strong> неактивний уже майже рік. Згідно з політикою зберігання
                    даних, неактивні акаунти видаляються разом з усіма даними. До видалення лишилось
                    приблизно <strong>{daysLeft} днів</strong>.
                </p>
                <p style="font-size: 15px;">
                    Щоб зберегти акаунт — просто зайдіть у застосунок. Якщо не бажаєте його зберігати,
                    нічого робити не потрібно.
                </p>
                <p style="font-size: 14px; margin-top: 24px;">Команда Всетута</p>
            </div>
            """;
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
