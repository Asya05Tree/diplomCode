using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Authorization;
using Server.Services;

namespace Server.Controllers;

public record AddCycleRecordRequest(DateOnly StartDate);
public record EndCycleRecordRequest(DateOnly EndDate);
public record CycleDateRequest(DateOnly Date);
// [StringLength] на вільному тексті → 400 на завеликому рядку (ПЛАН P2-2).
public record CycleSettingsRequest(bool ReduceLoadOnHeavyDays, [property: StringLength(TextLimits.Name)] string? HygieneProduct);

// planner-spec.md §3.7. Цикл: записи, прогноз, налаштування. Уся логіка — у CycleService.
[ApiController]
[Route("api/cycle")]
[Authorize]
[RequireModule("cycle")]
public class CycleController : ControllerBase
{
    private readonly CycleService _cycleService;

    public CycleController(CycleService cycleService)
    {
        _cycleService = cycleService;
    }

    private int CurrentUserId => User.GetUserId();

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var cycle = await _cycleService.GetAsync(CurrentUserId);
        return Ok(cycle);
    }

    [HttpPost("records")]
    public async Task<IActionResult> AddRecord([FromBody] AddCycleRecordRequest request)
    {
        var id = await _cycleService.AddRecordAsync(CurrentUserId, request.StartDate);
        return Ok(new { id });
    }

    [HttpPost("records/{id}/end")]
    public async Task<IActionResult> EndRecord(int id, [FromBody] EndCycleRecordRequest request)
    {
        var ok = await _cycleService.EndRecordAsync(CurrentUserId, id, request.EndDate);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("records/{id}")]
    public async Task<IActionResult> DeleteRecord(int id)
    {
        var ok = await _cycleService.DeleteRecordAsync(CurrentUserId, id);
        return ok ? Ok() : NotFound();
    }

    // Дата-орієнтовані позначення (кліком на будь-якому календарі — дані єдині)
    [HttpPost("start")]
    public async Task<IActionResult> MarkStart([FromBody] CycleDateRequest request)
    {
        var id = await _cycleService.StartByDateAsync(CurrentUserId, request.Date);
        return Ok(new { id });
    }

    [HttpPost("end")]
    public async Task<IActionResult> MarkEnd([FromBody] CycleDateRequest request)
    {
        var ok = await _cycleService.EndByDateAsync(CurrentUserId, request.Date);
        return ok ? Ok() : NotFound();
    }

    [HttpPost("clear")]
    public async Task<IActionResult> ClearDay([FromBody] CycleDateRequest request)
    {
        var ok = await _cycleService.ClearByDateAsync(CurrentUserId, request.Date);
        return ok ? Ok() : NotFound();
    }

    [HttpPut("settings")]
    public async Task<IActionResult> SetSettings([FromBody] CycleSettingsRequest request)
    {
        await _cycleService.SetSettingsAsync(CurrentUserId, request.ReduceLoadOnHeavyDays, request.HygieneProduct);
        return Ok();
    }
}
