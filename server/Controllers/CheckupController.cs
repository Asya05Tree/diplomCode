using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

public record CheckupVisitRequest(string DoctorKey, string DoctorName, DateTime When, string? Place, string? Note);

// Чекап здоров'я: заплановані візити до лікарів (створюють події ModuleCode="health" у календарі).
// Перелік лікарів — сталий на фронтенді; тут лише зберігаємо/видаляємо візити. Логіка — у CheckupService.
[ApiController]
[Route("api/checkup")]
[Authorize]
public class CheckupController : ControllerBase
{
    private readonly CheckupService _checkup;

    public CheckupController(CheckupService checkup)
    {
        _checkup = checkup;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    [HttpGet("visits")]
    public async Task<IActionResult> GetVisits() => Ok(await _checkup.GetVisitsAsync(CurrentUserId));

    [HttpPost("visits")]
    public async Task<IActionResult> AddVisit([FromBody] CheckupVisitRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.DoctorKey)) return BadRequest(new { error = "missing_doctor" });
        var id = await _checkup.AddVisitAsync(CurrentUserId, r.DoctorKey, r.DoctorName, r.When, r.Place, r.Note);
        return Ok(new { id });
    }

    [HttpDelete("visits/{id}")]
    public async Task<IActionResult> DeleteVisit(int id) =>
        await _checkup.DeleteVisitAsync(CurrentUserId, id) ? Ok() : NotFound();
}
