using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record SetBalanceRequest(decimal Balance);
public record SetLimitRequest(string PeriodType, decimal Amount); // Week | Month
public record AddTransactionRequest(decimal Amount, string Type, string? Category, string? Description, DateTime? OccurredAt);

// planner-spec.md §3.6. Фінанси: баланс, ліміти, транзакції. Уся логіка — у FinanceService.
[ApiController]
[Route("api/finance")]
[Authorize]
public class FinanceController : ControllerBase
{
    private readonly FinanceService _financeService;

    public FinanceController(FinanceService financeService)
    {
        _financeService = financeService;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var finance = await _financeService.GetAsync(CurrentUserId);
        return Ok(finance);
    }

    [HttpPut("balance")]
    public async Task<IActionResult> SetBalance([FromBody] SetBalanceRequest request)
    {
        await _financeService.SetBalanceAsync(CurrentUserId, request.Balance);
        return Ok();
    }

    [HttpPut("limit")]
    public async Task<IActionResult> SetLimit([FromBody] SetLimitRequest request)
    {
        var ok = await _financeService.SetLimitAsync(CurrentUserId, request.PeriodType, request.Amount);
        return ok ? Ok() : BadRequest(new { error = "invalid_period" });
    }

    [HttpPost("transactions")]
    public async Task<IActionResult> AddTransaction([FromBody] AddTransactionRequest request)
    {
        var id = await _financeService.AddTransactionAsync(
            CurrentUserId, request.Amount, request.Type, request.Category, request.Description, request.OccurredAt);
        return id is null ? BadRequest(new { error = "invalid_type" }) : Ok(new { id });
    }

    [HttpDelete("transactions/{id}")]
    public async Task<IActionResult> DeleteTransaction(int id)
    {
        var ok = await _financeService.DeleteTransactionAsync(CurrentUserId, id);
        return ok ? Ok() : NotFound();
    }
}
