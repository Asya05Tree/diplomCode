using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Authorization;
using Server.Services;

namespace Server.Controllers;

public record WorkSettingsRequest(string JobName, string? Position, string? Employer, string PayType, decimal? Rate,
    string? Regime, string? Workplace, decimal? NormHours, bool FullRateRetained, int? ExtraVacationDays);
public record WorkShiftTypeRequest(string Name, string Color, TimeOnly StartTime, TimeOnly EndTime,
    string? Kind, TimeOnly? StartTime2, TimeOnly? EndTime2, decimal? OnCallMultiplier, bool? IsActive);
public record WorkScheduleRequest(int ShiftTypeId, WorkService.Recurrence Recurrence);
public record WorkContactRequest(string GroupName, string? Status, string FullName, string Phone,
    string? Email, DateOnly? Birthday, string? Socials, string? Telegram, string? Viber);
public record WorkLeaveRequest(string Type, DateOnly StartDate, DateOnly EndDate);
public record WorkMeetingRequest(string WithWhom, DateTime When, string? Place);
public record WorkObligationRequest(string Title, string? Note, DateOnly? DueDate, bool IsDone);
public record WorkProcessTaskRequest(string Title, string? Note, string? Status, DateOnly? DueDate);

// Модуль "Робота": профіль/оплата, типи змін, графік (створює правила ModuleCode="work"), календар
// змін, контакти, відсутності, зустрічі (створюють задачі ModuleCode="work") та зобов'язання.
// Уся логіка — у WorkService.
[ApiController]
[Route("api/work")]
[Authorize]
[RequireModule("work")]
public class WorkController : ControllerBase
{
    private readonly WorkService _work;

    public WorkController(WorkService work)
    {
        _work = work;
    }

    private int CurrentUserId => User.GetUserId();

    // ---- Профіль роботи -------------------------------------------------------

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings() => Ok(await _work.GetSettingsAsync(CurrentUserId));

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] WorkSettingsRequest r)
    {
        await _work.UpdateSettingsAsync(CurrentUserId,
            new WorkService.SettingsDto(r.JobName ?? "", r.Position, r.Employer, r.PayType, r.Rate,
                r.Regime ?? "standard", r.Workplace ?? "onsite", r.NormHours, r.FullRateRetained, r.ExtraVacationDays));
        return Ok();
    }

    // ---- Типи змін ------------------------------------------------------------

    [HttpGet("shift-types")]
    public async Task<IActionResult> GetShiftTypes() => Ok(await _work.GetShiftTypesAsync(CurrentUserId));

    [HttpPost("shift-types")]
    public async Task<IActionResult> AddShiftType([FromBody] WorkShiftTypeRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "missing_name" });
        var id = await _work.AddShiftTypeAsync(CurrentUserId, new WorkService.ShiftTypeDto(0, r.Name, r.Color, r.StartTime, r.EndTime,
            r.Kind ?? "normal", r.StartTime2, r.EndTime2, r.OnCallMultiplier, r.IsActive ?? true));
        return Ok(new { id });
    }

    [HttpPut("shift-types/{id}")]
    public async Task<IActionResult> UpdateShiftType(int id, [FromBody] WorkShiftTypeRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "missing_name" });
        var ok = await _work.UpdateShiftTypeAsync(CurrentUserId, id, new WorkService.ShiftTypeDto(id, r.Name, r.Color, r.StartTime, r.EndTime,
            r.Kind ?? "normal", r.StartTime2, r.EndTime2, r.OnCallMultiplier, r.IsActive ?? true));
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("shift-types/{id}")]
    public async Task<IActionResult> DeleteShiftType(int id) =>
        await _work.DeleteShiftTypeAsync(CurrentUserId, id) ? Ok() : NotFound();

    // ---- Записи графіка -------------------------------------------------------

    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule() => Ok(await _work.GetScheduleEntriesAsync(CurrentUserId));

    [HttpPost("schedule")]
    public async Task<IActionResult> AddSchedule([FromBody] WorkScheduleRequest r)
    {
        if (r.Recurrence is null) return BadRequest(new { error = "invalid_entry" });
        var id = await _work.AddScheduleEntryAsync(CurrentUserId, r.ShiftTypeId, r.Recurrence);
        return id is null ? NotFound() : Ok(new { id });
    }

    [HttpPut("schedule/{id}")]
    public async Task<IActionResult> UpdateSchedule(int id, [FromBody] WorkScheduleRequest r)
    {
        if (r.Recurrence is null) return BadRequest(new { error = "invalid_entry" });
        var ok = await _work.UpdateScheduleEntryAsync(CurrentUserId, id, r.ShiftTypeId, r.Recurrence);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("schedule/{id}")]
    public async Task<IActionResult> DeleteSchedule(int id) =>
        await _work.DeleteScheduleEntryAsync(CurrentUserId, id) ? Ok() : NotFound();

    [HttpGet("schedule/calendar")]
    public async Task<IActionResult> GetCalendar([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        // Діапазон не більше року: інакше розгортання графіка змін дає десятки тисяч входжень у пам'яті.
        if (from > to || to.DayNumber - from.DayNumber > 366) return BadRequest(new { error = "invalid_range" });
        return Ok(await _work.GetScheduleCalendarAsync(CurrentUserId, from, to));
    }

    [HttpGet("schedule/next")]
    public async Task<IActionResult> GetNextShift() => Ok(await _work.GetNextShiftAsync(CurrentUserId));

    // ---- Контакти -------------------------------------------------------------

    [HttpGet("contacts")]
    public async Task<IActionResult> GetContacts() => Ok(await _work.GetContactsAsync(CurrentUserId));

    [HttpPost("contacts")]
    public async Task<IActionResult> AddContact([FromBody] WorkContactRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.FullName)) return BadRequest(new { error = "missing_name" });
        var id = await _work.AddContactAsync(CurrentUserId, ToContactDto(0, r));
        return Ok(new { id });
    }

    [HttpPut("contacts/{id}")]
    public async Task<IActionResult> UpdateContact(int id, [FromBody] WorkContactRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.FullName)) return BadRequest(new { error = "missing_name" });
        var ok = await _work.UpdateContactAsync(CurrentUserId, id, ToContactDto(id, r));
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("contacts/{id}")]
    public async Task<IActionResult> DeleteContact(int id) =>
        await _work.DeleteContactAsync(CurrentUserId, id) ? Ok() : NotFound();

    private static WorkService.ContactDto ToContactDto(int id, WorkContactRequest r) =>
        new(id, r.GroupName ?? "", r.Status ?? "online", r.FullName, r.Phone ?? "", r.Email, r.Birthday, r.Socials, r.Telegram, r.Viber);

    // ---- Відсутності ----------------------------------------------------------

    [HttpGet("leaves")]
    public async Task<IActionResult> GetLeaves() => Ok(await _work.GetLeavesAsync(CurrentUserId));

    [HttpPost("leaves")]
    public async Task<IActionResult> AddLeave([FromBody] WorkLeaveRequest r)
    {
        var id = await _work.AddLeaveAsync(CurrentUserId, new WorkService.LeaveDto(0, r.Type, r.StartDate, r.EndDate));
        return Ok(new { id });
    }

    [HttpPut("leaves/{id}")]
    public async Task<IActionResult> UpdateLeave(int id, [FromBody] WorkLeaveRequest r)
    {
        var ok = await _work.UpdateLeaveAsync(CurrentUserId, id, new WorkService.LeaveDto(id, r.Type, r.StartDate, r.EndDate));
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("leaves/{id}")]
    public async Task<IActionResult> DeleteLeave(int id) =>
        await _work.DeleteLeaveAsync(CurrentUserId, id) ? Ok() : NotFound();

    // ---- Зустрічі -------------------------------------------------------------

    [HttpGet("meetings")]
    public async Task<IActionResult> GetMeetings() => Ok(await _work.GetMeetingsAsync(CurrentUserId));

    [HttpPost("meetings")]
    public async Task<IActionResult> AddMeeting([FromBody] WorkMeetingRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.WithWhom)) return BadRequest(new { error = "missing_with" });
        var id = await _work.AddMeetingAsync(CurrentUserId, r.WithWhom, r.When, r.Place);
        return Ok(new { id });
    }

    [HttpPut("meetings/{id}")]
    public async Task<IActionResult> UpdateMeeting(int id, [FromBody] WorkMeetingRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.WithWhom)) return BadRequest(new { error = "missing_with" });
        var ok = await _work.UpdateMeetingAsync(CurrentUserId, id, r.WithWhom, r.When, r.Place);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("meetings/{id}")]
    public async Task<IActionResult> DeleteMeeting(int id) =>
        await _work.DeleteMeetingAsync(CurrentUserId, id) ? Ok() : NotFound();

    // ---- Зобов'язання ---------------------------------------------------------

    [HttpGet("obligations")]
    public async Task<IActionResult> GetObligations() => Ok(await _work.GetObligationsAsync(CurrentUserId));

    [HttpPost("obligations")]
    public async Task<IActionResult> AddObligation([FromBody] WorkObligationRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Title)) return BadRequest(new { error = "missing_title" });
        var id = await _work.AddObligationAsync(CurrentUserId, r.Title, r.Note, r.DueDate);
        return Ok(new { id });
    }

    [HttpPut("obligations/{id}")]
    public async Task<IActionResult> UpdateObligation(int id, [FromBody] WorkObligationRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Title)) return BadRequest(new { error = "missing_title" });
        var ok = await _work.UpdateObligationAsync(CurrentUserId, id, r.Title, r.Note, r.DueDate, r.IsDone);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("obligations/{id}")]
    public async Task<IActionResult> DeleteObligation(int id) =>
        await _work.DeleteObligationAsync(CurrentUserId, id) ? Ok() : NotFound();

    // ---- Планування процесу ---------------------------------------------------

    [HttpGet("process")]
    public async Task<IActionResult> GetProcess() => Ok(await _work.GetProcessTasksAsync(CurrentUserId));

    [HttpPost("process")]
    public async Task<IActionResult> AddProcess([FromBody] WorkProcessTaskRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Title)) return BadRequest(new { error = "missing_title" });
        var id = await _work.AddProcessTaskAsync(CurrentUserId, r.Title, r.Note, r.Status ?? "planned", r.DueDate);
        return Ok(new { id });
    }

    [HttpPut("process/{id}")]
    public async Task<IActionResult> UpdateProcess(int id, [FromBody] WorkProcessTaskRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Title)) return BadRequest(new { error = "missing_title" });
        var ok = await _work.UpdateProcessTaskAsync(CurrentUserId, id, r.Title, r.Note, r.Status ?? "planned", r.DueDate);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("process/{id}")]
    public async Task<IActionResult> DeleteProcess(int id) =>
        await _work.DeleteProcessTaskAsync(CurrentUserId, id) ? Ok() : NotFound();
}
