using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record StudySubjectRequest(string NameUk, string? NameEn, string? Teacher, string? Room, string? Color);
public record StudyAssignmentRequest(int? SubjectId, string Type, string Title, DateOnly? DueDate, bool IsDone);
public record ReplaceBellsRequest(List<StudyService.BellDto> Bells);
public record ReplaceGradeScaleRequest(List<StudyService.GradeScaleDto> Scale);

// Модуль "Навчання": предмети, завдання, сітка дзвінків, шкала оцінок. Розклад пар — окремо, через
// api/recurrence-rules з ModuleCode="study" (тут не дублюється). Уся логіка — у StudyService.
[ApiController]
[Route("api/study")]
[Authorize]
public class StudyController : ControllerBase
{
    private readonly StudyService _studyService;

    public StudyController(StudyService studyService)
    {
        _studyService = studyService;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    // ---- Предмети -------------------------------------------------------------

    [HttpGet("subjects")]
    public async Task<IActionResult> GetSubjects() => Ok(await _studyService.GetSubjectsAsync(CurrentUserId));

    [HttpPost("subjects")]
    public async Task<IActionResult> AddSubject([FromBody] StudySubjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NameUk)) return BadRequest(new { error = "missing_name" });
        var id = await _studyService.AddSubjectAsync(CurrentUserId, request.NameUk, request.NameEn, request.Teacher, request.Room, request.Color);
        return Ok(new { id });
    }

    [HttpPut("subjects/{id}")]
    public async Task<IActionResult> UpdateSubject(int id, [FromBody] StudySubjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NameUk)) return BadRequest(new { error = "missing_name" });
        var ok = await _studyService.UpdateSubjectAsync(CurrentUserId, id, request.NameUk, request.NameEn, request.Teacher, request.Room, request.Color);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("subjects/{id}")]
    public async Task<IActionResult> DeleteSubject(int id)
    {
        var ok = await _studyService.DeleteSubjectAsync(CurrentUserId, id);
        return ok ? Ok() : NotFound();
    }

    // ---- Завдання -------------------------------------------------------------

    [HttpGet("assignments")]
    public async Task<IActionResult> GetAssignments() => Ok(await _studyService.GetAssignmentsAsync(CurrentUserId));

    [HttpPost("assignments")]
    public async Task<IActionResult> AddAssignment([FromBody] StudyAssignmentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest(new { error = "missing_title" });
        var id = await _studyService.AddAssignmentAsync(CurrentUserId, request.SubjectId, request.Type, request.Title, request.DueDate, request.IsDone);
        return Ok(new { id });
    }

    [HttpPut("assignments/{id}")]
    public async Task<IActionResult> UpdateAssignment(int id, [FromBody] StudyAssignmentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest(new { error = "missing_title" });
        var ok = await _studyService.UpdateAssignmentAsync(CurrentUserId, id, request.SubjectId, request.Type, request.Title, request.DueDate, request.IsDone);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("assignments/{id}")]
    public async Task<IActionResult> DeleteAssignment(int id)
    {
        var ok = await _studyService.DeleteAssignmentAsync(CurrentUserId, id);
        return ok ? Ok() : NotFound();
    }

    // ---- Дзвінки й шкала оцінок (заміна всієї сітки) --------------------------

    [HttpGet("bells")]
    public async Task<IActionResult> GetBells() => Ok(await _studyService.GetBellsAsync(CurrentUserId));

    [HttpPut("bells")]
    public async Task<IActionResult> ReplaceBells([FromBody] ReplaceBellsRequest request)
    {
        await _studyService.ReplaceBellsAsync(CurrentUserId, request.Bells ?? new List<StudyService.BellDto>());
        return Ok();
    }

    [HttpGet("grade-scale")]
    public async Task<IActionResult> GetGradeScale() => Ok(await _studyService.GetGradeScaleAsync(CurrentUserId));

    [HttpPut("grade-scale")]
    public async Task<IActionResult> ReplaceGradeScale([FromBody] ReplaceGradeScaleRequest request)
    {
        await _studyService.ReplaceGradeScaleAsync(CurrentUserId, request.Scale ?? new List<StudyService.GradeScaleDto>());
        return Ok();
    }
}
