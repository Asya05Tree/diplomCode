using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

// [StringLength] → 400 на завеликому рядку (обхід клієнтського maxLength) — ПЛАН P2-2.
public record VaccinationRecordRequest(int? DoseId,
    [StringLength(TextLimits.Name)] string? CustomName, DateTime DoneDate,
    [StringLength(TextLimits.Note)] string? Note);

public record VaccinationUpdateRequest(DateTime DoneDate, [StringLength(TextLimits.Note)] string? Note);

// Щеплення (вкладка "Здоров'я"): системний довідник доз + відмітки користувача. Планування візиту
// для майбутньої дози переюзає чекап (api/checkup). Логіка — у VaccinationService.
[ApiController]
[Route("api/vaccination")]
[Authorize]
public class VaccinationController : ControllerBase
{
    private readonly VaccinationService _vacc;

    public VaccinationController(VaccinationService vacc)
    {
        _vacc = vacc;
    }

    private int CurrentUserId => User.GetUserId();

    // Довідник доз + відмітки користувача (статуси рахує клієнт із віку профілю).
    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _vacc.GetAsync(CurrentUserId));

    [HttpPost("records")]
    public async Task<IActionResult> AddRecord([FromBody] VaccinationRecordRequest r)
    {
        if (r.DoseId is null && string.IsNullOrWhiteSpace(r.CustomName))
            return BadRequest(new { error = "missing_dose_or_name" });
        try
        {
            var id = await _vacc.AddRecordAsync(CurrentUserId, r.DoseId, r.CustomName, r.DoneDate, r.Note);
            return Ok(new { id });
        }
        catch (ArgumentException)
        {
            return BadRequest(new { error = "invalid_record" });
        }
    }

    [HttpPut("records/{id}")]
    public async Task<IActionResult> UpdateRecord(int id, [FromBody] VaccinationUpdateRequest r) =>
        await _vacc.UpdateRecordAsync(CurrentUserId, id, r.DoneDate, r.Note) ? Ok() : NotFound();

    [HttpDelete("records/{id}")]
    public async Task<IActionResult> DeleteRecord(int id) =>
        await _vacc.DeleteRecordAsync(CurrentUserId, id) ? Ok() : NotFound();
}
