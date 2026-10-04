using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record CreateRecurrenceRuleRequest(
    string Title, string? Description, int? DurationMinutes,
    string Type, TimeOnly TimeOfDay, DateOnly StartDate, DateOnly? EndDate,
    int? CycleWeeks, DateOnly? CycleAnchorDate, string? WeekDaysPattern, string? WeekDayTimesPattern,
    int? IntervalDays,
    string? MonthDayMode, string? MonthDays);

public record UpdateRecurrenceRuleRequest(
    string Title, string? Description, int? DurationMinutes,
    string Type, TimeOnly TimeOfDay, DateOnly StartDate, DateOnly? EndDate,
    int? CycleWeeks, DateOnly? CycleAnchorDate, string? WeekDaysPattern, string? WeekDayTimesPattern,
    int? IntervalDays,
    string? MonthDayMode, string? MonthDays);

public record AddExceptionRequest(DateOnly Date, string ExceptionType, DateTime? NewDateTime); // Cancelled | Moved
public record ManualDateRequest(DateOnly Date);

// Режим "Повторювані" (planner-spec.md §3.3, §4.3) — чотири типи правил повторення + винятки
// + ручні дати. Кожне правило супроводжує шаблон-задачу (Title/Duration/Description) — керує нею TaskService.
[ApiController]
[Route("api/recurrence-rules")]
[Authorize]
public class RecurrenceRulesController : ControllerBase
{
    private static readonly string[] ValidTypes = { "WeekCycle", "EveryNDays", "MonthDays", "Manual" };
    private static readonly string[] ValidMonthDayModes = { "Specific", "Even", "Odd", "LastDay" };

    // Спільна межа календаря (planner-spec.md §3.3) — далі планувати не можна
    private const int MaxRecurrenceYears = 1;

    private readonly TaskService _taskService;

    public RecurrenceRulesController(TaskService taskService)
    {
        _taskService = taskService;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    private static bool IsValidRule(
        string title, string type, DateOnly startDate, DateOnly? endDate,
        int? cycleWeeks, DateOnly? cycleAnchorDate, string? weekDaysPattern,
        int? intervalDays, string? monthDayMode, string? monthDays)
    {
        if (string.IsNullOrWhiteSpace(title)) return false;
        if (!ValidTypes.Contains(type)) return false;
        if (!endDate.HasValue || endDate.Value > startDate.AddYears(MaxRecurrenceYears) || endDate.Value < startDate)
            return false;

        return type switch
        {
            "WeekCycle" => cycleWeeks is >= 1 and <= 4
                && (cycleWeeks == 1 || cycleAnchorDate.HasValue)
                && !string.IsNullOrWhiteSpace(weekDaysPattern),
            "EveryNDays" => intervalDays is >= 1,
            "MonthDays" => ValidMonthDayModes.Contains(monthDayMode)
                && (monthDayMode != "Specific" || !string.IsNullOrWhiteSpace(monthDays)),
            "Manual" => true, // дати додаються окремими запитами після створення
            _ => false,
        };
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rules = await _taskService.GetRecurrenceRulesAsync(CurrentUserId);
        return Ok(rules);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRecurrenceRuleRequest request)
    {
        if (!IsValidRule(request.Title, request.Type, request.StartDate, request.EndDate,
                request.CycleWeeks, request.CycleAnchorDate, request.WeekDaysPattern,
                request.IntervalDays, request.MonthDayMode, request.MonthDays))
            return BadRequest(new { error = "invalid_rule" });

        var rule = await _taskService.CreateRecurrenceRuleAsync(
            CurrentUserId, request.Title, request.Description, request.DurationMinutes,
            request.Type, request.TimeOfDay, request.StartDate, request.EndDate,
            request.CycleWeeks, request.CycleAnchorDate, request.WeekDaysPattern, request.WeekDayTimesPattern,
            request.IntervalDays, request.MonthDayMode, request.MonthDays);
        return Ok(rule);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRecurrenceRuleRequest request)
    {
        if (!IsValidRule(request.Title, request.Type, request.StartDate, request.EndDate,
                request.CycleWeeks, request.CycleAnchorDate, request.WeekDaysPattern,
                request.IntervalDays, request.MonthDayMode, request.MonthDays))
            return BadRequest(new { error = "invalid_rule" });

        var ok = await _taskService.UpdateRecurrenceRuleAsync(
            CurrentUserId, id, request.Title, request.Description, request.DurationMinutes,
            request.Type, request.TimeOfDay, request.StartDate, request.EndDate,
            request.CycleWeeks, request.CycleAnchorDate, request.WeekDaysPattern, request.WeekDayTimesPattern,
            request.IntervalDays, request.MonthDayMode, request.MonthDays);
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

    [HttpPost("{id}/manual-dates")]
    public async Task<IActionResult> AddManualDate(int id, [FromBody] ManualDateRequest request)
    {
        var ok = await _taskService.AddManualDateAsync(CurrentUserId, id, request.Date);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("{id}/manual-dates/{date}")]
    public async Task<IActionResult> DeleteManualDate(int id, DateOnly date)
    {
        var ok = await _taskService.DeleteManualDateAsync(CurrentUserId, id, date);
        return ok ? Ok() : NotFound();
    }
}
