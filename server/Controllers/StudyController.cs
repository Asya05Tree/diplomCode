using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Authorization;
using Server.Services;

namespace Server.Controllers;

// [StringLength] на текстових полях → 400 на завеликому рядку (клієнтський maxLength обходиться
// прямим викликом API; без цього зберігались блоби в сотні КБ) — ПЛАН P2-2.
public record StudySettingsRequest([property: StringLength(TextLimits.Code)] string LearningForm,
    [property: StringLength(TextLimits.Code)] string TermType, DateOnly? StudyStart, DateOnly? StudyEnd,
    DateOnly? SemesterEnd, DateOnly? YearEnd, DateOnly? VacationStart, DateOnly? VacationEnd);

public record StudySubjectRequest([property: StringLength(TextLimits.Name)] string Name,
    [property: StringLength(TextLimits.Name)] string? Teacher, [property: StringLength(TextLimits.Color)] string? Color,
    [property: StringLength(TextLimits.Name)] string? LectureRoom, [property: StringLength(TextLimits.Name)] string? LectureLink,
    [property: StringLength(TextLimits.Name)] string? SeminarRoom, [property: StringLength(TextLimits.Name)] string? SeminarLink);

public record StudyAssignmentRequest(int? SubjectId, [property: StringLength(TextLimits.Code)] string Type,
    [property: StringLength(TextLimits.Description)] string Description, [property: StringLength(TextLimits.Code)] string DeadlineKind,
    DateOnly? DueDate, bool IsDone, decimal? Grade);

public record ReplaceBellsRequest(List<StudyService.BellDto> Bells);

public record StudyScheduleRequest([property: StringLength(TextLimits.Code)] string EntryKind, int? SubjectId,
    [property: StringLength(TextLimits.Name)] string? Name, [property: StringLength(TextLimits.Code)] string? SessionKind,
    int? PairNumber, [property: StringLength(TextLimits.Code)] string? Form, [property: StringLength(TextLimits.Name)] string? Room,
    [property: StringLength(TextLimits.Name)] string? Link, StudyService.Recurrence Recurrence);

public record StudyProjectRequest([property: StringLength(TextLimits.Code)] string Kind,
    [property: StringLength(TextLimits.Name)] string Name, [property: StringLength(TextLimits.Name)] string? Curator,
    [property: StringLength(TextLimits.Code)] string? DeadlineKind, DateOnly? DueDate);
public record StudyStepRequest([property: StringLength(TextLimits.Name)] string Name, DateOnly? StartDate, DateOnly? EndDate, bool IsDone);

// Модуль "Навчання": налаштування, предмети, завдання, сітка дзвінків, розклад/консультації та
// великі роботи (диплом/курсова/практика). Розклад і консультації також створюють правило повторення
// (ModuleCode="study"), тому з'являються і в спільному календарі. Уся логіка — у StudyService.
[ApiController]
[Route("api/study")]
[Authorize]
[RequireModule("study")]
public class StudyController : ControllerBase
{
    private static readonly string[] AssignmentTypes = { "homework", "lab", "exam", "practical" };
    private static readonly string[] DeadlineKinds = { "semester", "year", "week", "tomorrow", "date" };
    private static readonly string[] EntryKinds = { "lesson", "consultation", "elective" };
    private static readonly string[] ProjectKinds = { "diploma", "coursework", "practice" };

    private readonly StudyService _studyService;

    public StudyController(StudyService studyService)
    {
        _studyService = studyService;
    }

    private int CurrentUserId => User.GetUserId();

    // ---- Налаштування навчання ------------------------------------------------

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings() => Ok(await _studyService.GetSettingsAsync(CurrentUserId));

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] StudySettingsRequest r)
    {
        await _studyService.UpdateSettingsAsync(CurrentUserId, new StudyService.SettingsDto(
            r.LearningForm, r.TermType, r.StudyStart, r.StudyEnd, r.SemesterEnd, r.YearEnd, r.VacationStart, r.VacationEnd));
        return Ok();
    }

    // ---- Предмети -------------------------------------------------------------

    [HttpGet("subjects")]
    public async Task<IActionResult> GetSubjects() => Ok(await _studyService.GetSubjectsAsync(CurrentUserId));

    [HttpPost("subjects")]
    public async Task<IActionResult> AddSubject([FromBody] StudySubjectRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "missing_name" });
        var id = await _studyService.AddSubjectAsync(CurrentUserId, ToSubjectDto(0, r));
        return Ok(new { id });
    }

    [HttpPut("subjects/{id}")]
    public async Task<IActionResult> UpdateSubject(int id, [FromBody] StudySubjectRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "missing_name" });
        var ok = await _studyService.UpdateSubjectAsync(CurrentUserId, id, ToSubjectDto(id, r));
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("subjects/{id}")]
    public async Task<IActionResult> DeleteSubject(int id) =>
        await _studyService.DeleteSubjectAsync(CurrentUserId, id) ? Ok() : NotFound();

    private static StudyService.SubjectDto ToSubjectDto(int id, StudySubjectRequest r) =>
        new(id, r.Name, r.Teacher, r.Color, r.LectureRoom, r.LectureLink, r.SeminarRoom, r.SeminarLink);

    // ---- Завдання -------------------------------------------------------------

    [HttpGet("assignments")]
    public async Task<IActionResult> GetAssignments() => Ok(await _studyService.GetAssignmentsAsync(CurrentUserId));

    [HttpPost("assignments")]
    public async Task<IActionResult> AddAssignment([FromBody] StudyAssignmentRequest r)
    {
        if (!ValidAssignment(r, out var error)) return BadRequest(new { error });
        var id = await _studyService.AddAssignmentAsync(CurrentUserId, r.SubjectId, r.Type, r.Description,
            r.DeadlineKind, r.DueDate, r.IsDone, r.Grade);
        return Ok(new { id });
    }

    [HttpPut("assignments/{id}")]
    public async Task<IActionResult> UpdateAssignment(int id, [FromBody] StudyAssignmentRequest r)
    {
        if (!ValidAssignment(r, out var error)) return BadRequest(new { error });
        var ok = await _studyService.UpdateAssignmentAsync(CurrentUserId, id, r.SubjectId, r.Type, r.Description,
            r.DeadlineKind, r.DueDate, r.IsDone, r.Grade);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("assignments/{id}")]
    public async Task<IActionResult> DeleteAssignment(int id) =>
        await _studyService.DeleteAssignmentAsync(CurrentUserId, id) ? Ok() : NotFound();

    private static bool ValidAssignment(StudyAssignmentRequest r, out string error)
    {
        if (string.IsNullOrWhiteSpace(r.Description)) { error = "missing_description"; return false; }
        if (!AssignmentTypes.Contains(r.Type)) { error = "invalid_type"; return false; }
        if (!DeadlineKinds.Contains(r.DeadlineKind)) { error = "invalid_deadline"; return false; }
        error = "";
        return true;
    }

    // ---- Дзвінки (заміна всієї сітки) -----------------------------------------

    [HttpGet("bells")]
    public async Task<IActionResult> GetBells() => Ok(await _studyService.GetBellsAsync(CurrentUserId));

    [HttpPut("bells")]
    public async Task<IActionResult> ReplaceBells([FromBody] ReplaceBellsRequest r)
    {
        await _studyService.ReplaceBellsAsync(CurrentUserId, r.Bells ?? new List<StudyService.BellDto>());
        return Ok();
    }

    // ---- Розклад / консультації / факультативи --------------------------------

    [HttpGet("schedule")]
    public async Task<IActionResult> GetSchedule([FromQuery] string? kind) =>
        Ok(await _studyService.GetScheduleEntriesAsync(CurrentUserId, EntryKinds.Contains(kind) ? kind : null));

    [HttpPost("schedule")]
    public async Task<IActionResult> AddSchedule([FromBody] StudyScheduleRequest r)
    {
        if (!EntryKinds.Contains(r.EntryKind) || r.Recurrence is null) return BadRequest(new { error = "invalid_entry" });
        var id = await _studyService.AddScheduleEntryAsync(CurrentUserId, r.EntryKind, r.SubjectId, r.Name,
            r.SessionKind, r.PairNumber, r.Form, r.Room, r.Link, r.Recurrence);
        return Ok(new { id });
    }

    [HttpPut("schedule/{id}")]
    public async Task<IActionResult> UpdateSchedule(int id, [FromBody] StudyScheduleRequest r)
    {
        if (!EntryKinds.Contains(r.EntryKind) || r.Recurrence is null) return BadRequest(new { error = "invalid_entry" });
        var ok = await _studyService.UpdateScheduleEntryAsync(CurrentUserId, id, r.EntryKind, r.SubjectId, r.Name,
            r.SessionKind, r.PairNumber, r.Form, r.Room, r.Link, r.Recurrence);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("schedule/{id}")]
    public async Task<IActionResult> DeleteSchedule(int id) =>
        await _studyService.DeleteScheduleEntryAsync(CurrentUserId, id) ? Ok() : NotFound();

    // ---- Великі роботи (диплом / курсова / практика) --------------------------

    [HttpGet("projects")]
    public async Task<IActionResult> GetProjects([FromQuery] string? kind) =>
        Ok(await _studyService.GetProjectsAsync(CurrentUserId, ProjectKinds.Contains(kind) ? kind : null));

    [HttpPost("projects")]
    public async Task<IActionResult> AddProject([FromBody] StudyProjectRequest r)
    {
        if (!ProjectKinds.Contains(r.Kind)) return BadRequest(new { error = "invalid_kind" });
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "missing_name" });
        var id = await _studyService.AddProjectAsync(CurrentUserId, r.Kind, r.Name, r.Curator, r.DeadlineKind, r.DueDate);
        return Ok(new { id });
    }

    [HttpPut("projects/{id}")]
    public async Task<IActionResult> UpdateProject(int id, [FromBody] StudyProjectRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "missing_name" });
        var ok = await _studyService.UpdateProjectAsync(CurrentUserId, id, r.Name, r.Curator, r.DeadlineKind, r.DueDate);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("projects/{id}")]
    public async Task<IActionResult> DeleteProject(int id) =>
        await _studyService.DeleteProjectAsync(CurrentUserId, id) ? Ok() : NotFound();

    [HttpPost("projects/{projectId}/steps")]
    public async Task<IActionResult> AddStep(int projectId, [FromBody] StudyStepRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "missing_name" });
        var id = await _studyService.AddStepAsync(CurrentUserId, projectId, r.Name, r.StartDate, r.EndDate, r.IsDone);
        return id is null ? NotFound() : Ok(new { id });
    }

    [HttpPut("steps/{stepId}")]
    public async Task<IActionResult> UpdateStep(int stepId, [FromBody] StudyStepRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name)) return BadRequest(new { error = "missing_name" });
        var ok = await _studyService.UpdateStepAsync(CurrentUserId, stepId, r.Name, r.StartDate, r.EndDate, r.IsDone);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("steps/{stepId}")]
    public async Task<IActionResult> DeleteStep(int stepId) =>
        await _studyService.DeleteStepAsync(CurrentUserId, stepId) ? Ok() : NotFound();
}
