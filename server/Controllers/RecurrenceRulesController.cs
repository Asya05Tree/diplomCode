using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record CreateRecurrenceRuleRequest(
    string Title, string? Description, int? DurationMinutes,
    string Pattern, string? DaysOfWeek, TimeOnly TimeOfDay, DateOnly StartDate, DateOnly? EndDate);

public record UpdateRecurrenceRuleRequest(
    string Title, string? Description, int? DurationMinutes,
    string Pattern, string? DaysOfWeek, TimeOnly TimeOfDay, DateOnly StartDate, DateOnly? EndDate);

public record AddExceptionRequest(DateOnly Date, string ExceptionType, DateTime? NewDateTime); // Cancelled | Moved

// Режим "Повторювані" (planner-spec.md §4.3): правила повторення + винятки.
// Кожне правило супроводжує шаблон-задачу (Title/Duration/Description) — керує нею TaskService.
[ApiController]
[Route("api/recurrence-rules")]
[Authorize]
public class RecurrenceRulesController : ControllerBase
{
    private static readonly string[] ValidPatterns = { "Daily", "Weekly", "Monthly" };

    private readonly TaskService _taskService;

    public RecurrenceRulesController(TaskService taskService)
    {
        _taskService = taskService;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    private static bool IsValidRule(string title, string pattern, string? daysOfWeek) =>
        !string.IsNullOrWhiteSpace(title)
        && ValidPatterns.Contains(pattern)
        && (pattern != "Weekly" || !string.IsNullOrWhiteSpace(daysOfWeek));

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rules = await _taskService.GetRecurrenceRulesAsync(CurrentUserId);
        return Ok(rules);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRecurrenceRuleRequest request)
    {
        if (!IsValidRule(request.Title, request.Pattern, request.DaysOfWeek))
            return BadRequest(new { error = "invalid_rule" });

        var rule = await _taskService.CreateRecurrenceRuleAsync(
            CurrentUserId, request.Title, request.Description, request.DurationMinutes,
            request.Pattern, request.DaysOfWeek, request.TimeOfDay, request.StartDate, request.EndDate);
        return Ok(rule);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRecurrenceRuleRequest request)
    {
        if (!IsValidRule(request.Title, request.Pattern, request.DaysOfWeek))
            return BadRequest(new { error = "invalid_rule" });

        var ok = await _taskService.UpdateRecurrenceRuleAsync(
            CurrentUserId, id, request.Title, request.Description, request.DurationMinutes,
            request.Pattern, request.DaysOfWeek, request.TimeOfDay, request.StartDate, request.EndDate);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _taskService.DeleteRecurrenceRuleAsync(CurrentUserId, id);
        return ok ? Ok() : NotFound();
    }

    [HttpGet("{id}/preview")]
    public async Task<IActionResult> Preview(int id, [FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        if (from > to) return BadRequest(new { error = "invalid_range" });
        var preview = await _taskService.GetRulePreviewAsync(CurrentUserId, id, from, to);
        return Ok(preview);
    }

    [HttpPost("{id}/exceptions")]
    public async Task<IActionResult> AddException(int id, [FromBody] AddExceptionRequest request)
    {
        if (request.ExceptionType is not ("Cancelled" or "Moved"))
            return BadRequest(new { error = "invalid_exception_type" });
        if (request.ExceptionType == "Moved" && request.NewDateTime is null)
            return BadRequest(new { error = "missing_new_date_time" });

        var ex = await _taskService.AddExceptionAsync(CurrentUserId, id, request.Date, request.ExceptionType, request.NewDateTime);
        return ex is null ? NotFound() : Ok(ex);
    }

    [HttpDelete("{id}/exceptions/{exceptionId}")]
    public async Task<IActionResult> DeleteException(int id, int exceptionId)
    {
        var ok = await _taskService.DeleteExceptionAsync(CurrentUserId, id, exceptionId);
        return ok ? Ok() : NotFound();
    }
}
