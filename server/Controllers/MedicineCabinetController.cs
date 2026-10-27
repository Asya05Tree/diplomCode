using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record UpdateMedicineRequest(string State, DateTime? ExpiresAt); // Available | RunningLow | OutOfStock
public record AddConditionRequest(string NameUk, bool AffectsFood, string? Tag, string Relation); // Forbidden | Avoid

// planner-spec.md §3.5. Аптечка: особистий список ліків, пошук у довіднику ДРЛЗ для додавання,
// перевірка взаємодій на рівні діючої речовини та хронічні хвороби (що можуть впливати на "Їжу").
[ApiController]
[Route("api/medicine-cabinet")]
[Authorize]
public class MedicineCabinetController : ControllerBase
{
    private readonly MedicineService _medicineService;

    public MedicineCabinetController(MedicineService medicineService)
    {
        _medicineService = medicineService;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    [HttpGet]
    public async Task<IActionResult> GetCabinet()
    {
        var items = await _medicineService.GetCabinetAsync(CurrentUserId);
        return Ok(items);
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q)
    {
        var results = await _medicineService.SearchAsync(CurrentUserId, q);
        return Ok(results);
    }

    [HttpPost("{medicineId}")]
    public async Task<IActionResult> Add(int medicineId)
    {
        var ok = await _medicineService.AddToCabinetAsync(CurrentUserId, medicineId);
        return ok ? Ok() : NotFound();
    }

    [HttpPut("{medicineId}")]
    public async Task<IActionResult> Update(int medicineId, [FromBody] UpdateMedicineRequest request)
    {
        var ok = await _medicineService.UpdateCabinetAsync(CurrentUserId, medicineId, request.State, request.ExpiresAt);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("{medicineId}")]
    public async Task<IActionResult> Delete(int medicineId)
    {
        var ok = await _medicineService.RemoveFromCabinetAsync(CurrentUserId, medicineId);
        return ok ? Ok() : NotFound();
    }

    [HttpGet("{medicineId}/interactions")]
    public async Task<IActionResult> GetInteractions(int medicineId)
    {
        var interactions = await _medicineService.GetInteractionsAsync(CurrentUserId, medicineId);
        return Ok(interactions);
    }

    [HttpGet("conditions")]
    public async Task<IActionResult> GetConditions()
    {
        var conditions = await _medicineService.GetConditionsAsync(CurrentUserId);
        return Ok(conditions);
    }

    [HttpPost("conditions")]
    public async Task<IActionResult> AddCondition([FromBody] AddConditionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NameUk))
            return BadRequest(new { error = "missing_name" });

        var condition = await _medicineService.AddConditionAsync(
            CurrentUserId, request.NameUk, request.AffectsFood, request.Tag, request.Relation);
        return Ok(condition);
    }

    [HttpDelete("conditions/{id}")]
    public async Task<IActionResult> DeleteCondition(int id)
    {
        var ok = await _medicineService.DeleteConditionAsync(CurrentUserId, id);
        return ok ? Ok() : NotFound();
    }
}
