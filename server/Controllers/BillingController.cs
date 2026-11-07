using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

public record ConfirmRequest(string OrderReference);

// Білінг платної фічі "швидке додавання": стан/ліміт безкоштовних використань, списання одного
// використання (402 при вичерпанні), старт і підтвердження оплати. Уся логіка — в BillingService.
// callback/return викликає сама платіжка, тож вони без авторизації.
[ApiController]
[Route("api")]
public class BillingController : ControllerBase
{
    private readonly BillingService _billing;

    public BillingController(BillingService billing)
    {
        _billing = billing;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    // Поточний стан: скільки безкоштовних використань лишилось і чи куплено повний доступ.
    [Authorize]
    [HttpGet("quick-add/status")]
    public async Task<IActionResult> Status()
    {
        var s = await _billing.GetStatusAsync(CurrentUserId);
        return s is null ? NotFound() : Ok(s);
    }

    // Витратити одне безкоштовне використання. 402 → ліміт вичерпано й доступ не куплено.
    [Authorize]
    [HttpPost("quick-add/consume")]
    public async Task<IActionResult> Consume()
    {
        var (ok, status) = await _billing.ConsumeAsync(CurrentUserId);
        return ok ? Ok(status) : StatusCode(StatusCodes.Status402PaymentRequired, new { error = "limit_reached", status });
    }

    // Старт оплати: створює платіж і повертає дані для оплати (мок або поля форми WayForPay).
    [Authorize]
    [HttpPost("billing/checkout")]
    public async Task<IActionResult> Checkout()
    {
        var status = await _billing.GetStatusAsync(CurrentUserId);
        if (status is null) return NotFound();
        if (status.Unlocked) return Ok(new { alreadyUnlocked = true });
        var result = await _billing.CreateCheckoutAsync(CurrentUserId);
        return Ok(result);
    }

    // Підтвердження оплати після повернення з платіжки (перевірка статусу або мок).
    [Authorize]
    [HttpPost("billing/confirm")]
    public async Task<IActionResult> Confirm([FromBody] ConfirmRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.OrderReference)) return BadRequest(new { error = "missing_order" });
        var (paid, status) = await _billing.ConfirmAsync(CurrentUserId, r.OrderReference);
        return Ok(new { paid, status });
    }

    // Серверний callback від WayForPay (serviceUrl) — читаємо сире тіло й повертаємо accept-підпис.
    [AllowAnonymous]
    [HttpPost("billing/callback")]
    public async Task<IActionResult> Callback()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();
        var (ok, ack) = await _billing.HandleCallbackAsync(body);
        if (!ok) return BadRequest(new { error = "invalid_signature" });
        return Content(ack, "application/json");
    }

    // Повернення користувача з платіжки (returnUrl). Платіжка робить POST — приймаємо і GET, і POST,
    // і просто редіректимо браузер назад у застосунок із номером замовлення (?paid=...).
    [AllowAnonymous]
    [HttpGet("billing/return")]
    [HttpPost("billing/return")]
    public IActionResult Return([FromQuery] string? orderReference)
    {
        var baseUrl = _billing.ClientReturnUrl;
        var sep = baseUrl.Contains('?') ? '&' : '?';
        return Redirect($"{baseUrl}{sep}paid={Uri.EscapeDataString(orderReference ?? string.Empty)}");
    }
}
