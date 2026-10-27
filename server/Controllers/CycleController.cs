using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record AddCycleRecordRequest(DateOnly StartDate);
public record EndCycleRecordRequest(DateOnly EndDate);
public record CycleSettingsRequest(bool ReduceLoadOnHeavyDays);

// planner-spec.md §3.7. Цикл: записи, прогноз, налаштування. Уся логіка — у CycleService.
[ApiController]
[Route("api/cycle")]
[Authorize]
public class CycleController : ControllerBase
{
    private readonly CycleService _cycleService;

    public CycleController(CycleService cycleService)
    {
        _cycleService = cycleService;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

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

    [HttpPut("settings")]
    public async Task<IActionResult> SetSettings([FromBody] CycleSettingsRequest request)
    {
        await _cycleService.SetSettingsAsync(CurrentUserId, request.ReduceLoadOnHeavyDays);
        return Ok();
    }
}
