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

    public async Task SendVerificationCodeAsync(string email, string code)
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
            Subject = "Код підтвердження",
            Body = $"Ваш код підтвердження: {code}\nДіє 10 хвилин.",
        };

        await client.SendMailAsync(message);
    }
}
