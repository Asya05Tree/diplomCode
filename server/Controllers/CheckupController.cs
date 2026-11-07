using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

// [StringLength] на текстових полях → 400 на завеликому рядку (обхід клієнтського maxLength) — ПЛАН P2-2.
public record CheckupVisitRequest([StringLength(TextLimits.Code)] string DoctorKey,
    [StringLength(TextLimits.Name)] string DoctorName, DateTime When,
    [StringLength(TextLimits.Name)] string? Place, [StringLength(TextLimits.Description)] string? Note);

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

    private int CurrentUserId => User.GetUserId();

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
