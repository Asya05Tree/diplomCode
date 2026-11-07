using System.Globalization;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Server.Data;
using Server.Models;

namespace Server.Services;

// Стан платної фічі для клієнта. Unlocked=true → ліміт не діє (куплено назавжди).
public record QuickAddStatus(int Used, int Limit, int Remaining, bool Unlocked, decimal Price, string Currency);

// Результат старту оплати. Mock=true → клієнт показує власну сторінку-картку (демо без грошей).
// Для WayForPay повертаємо Action (URL форми) і Fields (підписані поля для автосабміту).
public record CheckoutResult(
    bool Mock,
    string OrderReference,
    decimal Amount,
    string Currency,
    string? Action,
    Dictionary<string, string>? Fields);

// Білінг платної фічі "швидке додавання": облік безкоштовних використань, розблокування назавжди
// та інтеграція з WayForPay (тестовий режим) або мок-режим для демонстрації без реальних грошей.
// Увесь стан (лічильник, прапор розблокування, платежі) — на сервері, не в localStorage, тож
// обійти через DevTools не можна.
public class BillingService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _cfg;
    private readonly IHttpClientFactory _http;

    public BillingService(AppDbContext db, IConfiguration cfg, IHttpClientFactory http)
    {
        _db = db;
        _cfg = cfg;
        _http = http;
    }

    // Мок за замовчуванням увімкнений: демо не залежить від інтернету/сандбоксу WayForPay.
    private bool Mock => _cfg.GetValue("Billing:Mock", true);
    private int FreeLimit => _cfg.GetValue("Billing:FreeLimit", 3);
    private decimal Price => _cfg.GetValue("Billing:Price", 100m);
    private string Currency => _cfg["Billing:Currency"] ?? "UAH";
    private string ApiBaseUrl => _cfg["Billing:ApiBaseUrl"] ?? "http://localhost:5080";
    public string ClientReturnUrl => _cfg["Billing:ClientReturnUrl"] ?? "http://localhost:5173/app/quick-add";

    public async Task<QuickAddStatus?> GetStatusAsync(int userId)
    {
        var u = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId);
        return u is null ? null : BuildStatus(u);
    }

    private QuickAddStatus BuildStatus(User u) =>
        new(u.QuickAddUsedCount, FreeLimit, Math.Max(0, FreeLimit - u.QuickAddUsedCount), u.QuickAddUnlocked, Price, Currency);

    // Витратити одне безкоштовне використання (виклик на старті підтвердження швидкого додавання).
    // ok=false → ліміт вичерпано й доступ не куплено (контролер віддасть 402 → клієнт покаже paywall).
    public async Task<(bool ok, QuickAddStatus status)> ConsumeAsync(int userId)
    {
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (u is null) return (false, new QuickAddStatus(0, FreeLimit, 0, false, Price, Currency));
        if (u.QuickAddUnlocked) return (true, BuildStatus(u));          // куплено — лічильник не чіпаємо
        if (u.QuickAddUsedCount >= FreeLimit) return (false, BuildStatus(u));
        u.QuickAddUsedCount++;
        await _db.SaveChangesAsync();
        return (true, BuildStatus(u));
    }

    // Створити платіж (Pending) і підготувати дані для оплати.
    public async Task<CheckoutResult> CreateCheckoutAsync(int userId)
    {
        var orderRef = $"qa-{userId}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..6]}";
        _db.Payments.Add(new Payment
        {
            UserId = userId,
            Feature = "quick-add",
            OrderReference = orderRef,
            Amount = Price,
            Currency = Currency,
            Status = "Pending",
            Provider = Mock ? "mock" : "wayforpay",
        });
        await _db.SaveChangesAsync();

        if (Mock)
            return new CheckoutResult(true, orderRef, Price, Currency, null, null);

        return new CheckoutResult(false, orderRef, Price, Currency,
            "https://secure.wayforpay.com/pay", BuildWayForPayFields(orderRef));
    }

    // Підтвердити оплату (після повернення з платіжки). Ідемпотентно: повторний виклик безпечний.
    // paid=false → оплату не підтверджено (ліміт/стан лишаються як є).
    public async Task<(bool paid, QuickAddStatus? status)> ConfirmAsync(int userId, string orderReference)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.OrderReference == orderReference && p.UserId == userId);
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == userId);
        if (payment is null || u is null) return (false, u is null ? null : BuildStatus(u));

        if (payment.Status == "Approved" || u.QuickAddUnlocked)
        {
            await EnsureUnlockedAsync(u, payment);
            return (true, BuildStatus(u));
        }

        var approved = Mock || await CheckWayForPayApprovedAsync(orderReference);
        if (!approved) return (false, BuildStatus(u));

        await EnsureUnlockedAsync(u, payment);
        return (true, BuildStatus(u));
    }

    // Серверний callback від WayForPay (serviceUrl). ok=false → тіло невалідне або підпис не збігся
    // (контролер віддасть 400 і нічого не розблокує). ok=true → ack-відповідь для платіжки.
    public async Task<(bool ok, string ack)> HandleCallbackAsync(string rawBody)
    {
        JsonElement root;
        try
        {
            using var doc = JsonDocument.Parse(rawBody);
            root = doc.RootElement.Clone();   // doc звільниться — тримаємо копію
        }
        catch { return (false, ""); }   // нерозпізнане тіло

        var orderRef = Str(root, "orderReference");
        if (string.IsNullOrEmpty(orderRef)) return (false, "");

        // Перевіряємо підпис WayForPay: HMAC-MD5 за полями у строго заданому порядку. Без валідного
        // підпису будь-хто міг би POST-нути "оплата пройшла" на [AllowAnonymous] callback і безкоштовно
        // розблокувати платну фічу — тому розбіжність підпису = відмова, нічого не розблоковуємо.
        var provided = Str(root, "merchantSignature");
        var expected = HmacMd5(string.Join(";",
            Str(root, "merchantAccount"), orderRef, Str(root, "amount"), Str(root, "currency"),
            Str(root, "authCode"), Str(root, "cardPan"), Str(root, "transactionStatus"), Str(root, "reasonCode")));
        if (string.IsNullOrEmpty(provided) || !string.Equals(provided, expected, StringComparison.OrdinalIgnoreCase))
            return (false, "");

        if (string.Equals(Str(root, "transactionStatus"), "Approved", StringComparison.OrdinalIgnoreCase))
        {
            var payment = await _db.Payments.Include(p => p.User).FirstOrDefaultAsync(p => p.OrderReference == orderRef);
            if (payment?.User is not null) await EnsureUnlockedAsync(payment.User, payment);
        }

        var time = ((DateTimeOffset)DateTime.UtcNow).ToUnixTimeSeconds();
        var respSign = HmacMd5(string.Join(";", orderRef, "accept", time));
        return (true, JsonSerializer.Serialize(new { orderReference = orderRef, status = "accept", time, signature = respSign }));
    }

    // Прочитати поле JSON як рядок незалежно від того, прийшло воно числом чи рядком.
    private static string Str(JsonElement root, string name) =>
        root.TryGetProperty(name, out var v)
            ? (v.ValueKind == JsonValueKind.String ? (v.GetString() ?? "") : v.ToString())
            : "";

    private async Task EnsureUnlockedAsync(User u, Payment p)
    {
        if (p.Status != "Approved") { p.Status = "Approved"; p.PaidAt = DateTime.UtcNow; }
        u.QuickAddUnlocked = true;
        await _db.SaveChangesAsync();
    }

    // --- WayForPay ---------------------------------------------------------------------------

    // Поля форми для автосабміту на secure.wayforpay.com/pay (один товар — повний доступ).
    private Dictionary<string, string> BuildWayForPayFields(string orderRef)
    {
        var merchant = _cfg["Billing:WayForPay:MerchantAccount"] ?? "test_merch_n1";
        var domain = _cfg["Billing:WayForPay:MerchantDomainName"] ?? "localhost";
        var orderDate = ((DateTimeOffset)DateTime.UtcNow).ToUnixTimeSeconds().ToString();
        var amount = Price.ToString(CultureInfo.InvariantCulture);
        var productName = _cfg["Billing:ProductName"] ?? "Швидке додавання — повний доступ";
        const string productCount = "1";
        var productPrice = amount;

        // Рядок підпису саме в цьому порядку (вимога WayForPay): merchantAccount;merchantDomainName;
        // orderReference;orderDate;amount;currency;productName[];productCount[];productPrice[].
        var signature = HmacMd5(string.Join(";",
            merchant, domain, orderRef, orderDate, amount, Currency, productName, productCount, productPrice));

        return new Dictionary<string, string>
        {
            ["merchantAccount"] = merchant,
            ["merchantDomainName"] = domain,
            ["merchantSignature"] = signature,
            ["orderReference"] = orderRef,
            ["orderDate"] = orderDate,
            ["amount"] = amount,
            ["currency"] = Currency,
            ["productName[]"] = productName,
            ["productCount[]"] = productCount,
            ["productPrice[]"] = productPrice,
            ["returnUrl"] = $"{ApiBaseUrl}/api/billing/return?orderReference={Uri.EscapeDataString(orderRef)}",
            ["serviceUrl"] = $"{ApiBaseUrl}/api/billing/callback",
            ["language"] = "UA",
        };
    }

    // Перевірка статусу замовлення через WayForPay API (вихідний запит — працює і з localhost).
    private async Task<bool> CheckWayForPayApprovedAsync(string orderRef)
    {
        var merchant = _cfg["Billing:WayForPay:MerchantAccount"] ?? "test_merch_n1";
        var payload = new
        {
            transactionType = "CHECK_STATUS",
            merchantAccount = merchant,
            orderReference = orderRef,
            apiVersion = 1,
            merchantSignature = HmacMd5(string.Join(";", merchant, orderRef)),
        };
        try
        {
            var client = _http.CreateClient();
            var resp = await client.PostAsJsonAsync("https://api.wayforpay.com/api", payload);
            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var status = doc.RootElement.TryGetProperty("transactionStatus", out var s) ? s.GetString() : null;
            return string.Equals(status, "Approved", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private string HmacMd5(string data)
    {
        // Секрет береться лише з конфігу середовища — без захардкодженого fallback у коді.
        var key = _cfg["Billing:WayForPay:MerchantSecretKey"];
        if (string.IsNullOrEmpty(key))
            throw new InvalidOperationException("Не налаштовано Billing:WayForPay:MerchantSecretKey.");
        using var h = new HMACMD5(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
    }
}
