using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record CreateTaskRequest(string Title, string? Description, DateTime? StartDateTime, int? DurationMinutes, DateTime? Deadline);
public record UpdateTaskRequest(string Title, string? Description, DateTime? StartDateTime, int? DurationMinutes, DateTime? Deadline);
public record ResolveTaskRequest(string Action); // Done | Skipped | Postpone

// Задачі й календар: День/Період/Нерозподілені (planner-spec.md §4.2-4.5). CRUD одноразової
// задачі + похідні вибірки з TaskService; повторення — окремо в RecurrenceRulesController.
[ApiController]
[Route("api/tasks")]
[Authorize]
public class TasksController : ControllerBase
{
    private readonly TaskService _taskService;

    public TasksController(TaskService taskService)
    {
        _taskService = taskService;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    [HttpGet("day")]
    public async Task<IActionResult> GetDay([FromQuery] DateOnly date)
    {
        var tasks = await _taskService.GetDayTasksAsync(CurrentUserId, date);
        return Ok(tasks);
    }

    [HttpGet("period")]
    public async Task<IActionResult> GetPeriod([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        if (from > to) return BadRequest(new { error = "invalid_range" });
        var tasks = await _taskService.GetPeriodTasksAsync(CurrentUserId, from, to);
        return Ok(tasks);
    }

    [HttpGet("free-days")]
    public async Task<IActionResult> GetFreeDays([FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] double minHours = 2)
    {
        if (from > to) return BadRequest(new { error = "invalid_range" });
        var days = await _taskService.GetFreeDaysAsync(CurrentUserId, from, to, minHours);
        return Ok(days);
    }

    [HttpGet("unassigned")]
    public async Task<IActionResult> GetUnassigned()
    {
        var tasks = await _taskService.GetUnassignedAsync(CurrentUserId);
        return Ok(tasks);
    }

    [HttpGet("unassigned/count")]
    public async Task<IActionResult> GetUnassignedCount()
    {
        var count = await _taskService.GetUnassignedCountAsync(CurrentUserId);
        return Ok(new { count });
    }

    [HttpGet("reminder")]
    public async Task<IActionResult> GetReminder()
    {
        var tasks = await _taskService.GetReminderAsync(CurrentUserId);
        return Ok(tasks);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTaskRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { error = "missing_title" });

        var task = await _taskService.CreateTaskAsync(
            CurrentUserId, request.Title, request.Description, request.StartDateTime, request.DurationMinutes, request.Deadline);
        return Ok(new { task.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTaskRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest(new { error = "missing_title" });

        var ok = await _taskService.UpdateTaskAsync(
            CurrentUserId, id, request.Title, request.Description, request.StartDateTime, request.DurationMinutes, request.Deadline);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _taskService.DeleteTaskAsync(CurrentUserId, id);
        return ok ? Ok() : NotFound();
    }

    [HttpPost("{id}/resolve")]
    public async Task<IActionResult> Resolve(int id, [FromBody] ResolveTaskRequest request)
    {
        if (request.Action is not ("Done" or "Skipped" or "Postpone"))
            return BadRequest(new { error = "invalid_action" });

        var ok = await _taskService.ResolveTaskAsync(CurrentUserId, id, request.Action);
        return ok ? Ok() : NotFound();
    }
}
