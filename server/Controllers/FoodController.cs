using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record SetStockStateRequest(string State); // Available | RunningLow | OutOfStock
// [StringLength]: назва — вільний текст, без межі приймались 8 КБ+ (ПЛАН P2-2, перенесено з P1-8). Завелике → 400.
public record AddStockByNameRequest([StringLength(TextLimits.Name)] string Name);
// Тижневе меню: заміна списку страв одного дня (за датою). add/remove/clear — усе через новий список.
public record PutMenuDayRequest(List<int>? RecipeIds);

// planner-spec.md §3.4. Екран "Їжа": збірний /overview для початкового завантаження сторінки
// + точкові дії над запасами/обраними стравами. Уся логіка — у RecipeService.
[ApiController]
[Route("api/food")]
[Authorize]
public class FoodController : ControllerBase
{
    private readonly RecipeService _recipeService;

    public FoodController(RecipeService recipeService)
    {
        _recipeService = recipeService;
    }

    private int CurrentUserId => User.GetUserId();

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var overview = await _recipeService.GetOverviewAsync(CurrentUserId);
        return Ok(overview);
    }

    [HttpPut("stock/{productId}")]
    public async Task<IActionResult> SetStock(int productId, [FromBody] SetStockStateRequest request)
    {
        // Невалідний стан кидає BadInputException (→ 400 invalid_stock) у сервісі; false означає, що
        // продукт недоступний (не існує або чужий приватний) → 404 (не плутати з «поганим значенням»).
        var ok = await _recipeService.SetStockStateAsync(CurrentUserId, productId, request.State);
        return ok ? Ok() : NotFound(new { error = "product_not_found" });
    }

    [HttpPost("stock/{productId}")]
    public async Task<IActionResult> AddStock(int productId)
    {
        var ok = await _recipeService.AddStockAsync(CurrentUserId, productId);
        return ok ? Ok() : NotFound();
    }

    [HttpPost("stock-by-name")]
    public async Task<IActionResult> AddStockByName([FromBody] AddStockByNameRequest request)
    {
        var result = await _recipeService.AddStockByNameAsync(CurrentUserId, request.Name);
        return result is not null ? Ok(result) : BadRequest(new { error = "empty_name" });
    }

    [HttpPost("selected/{recipeId}")]
    public async Task<IActionResult> AddSelected(int recipeId)
    {
        var ok = await _recipeService.ToggleSelectedAsync(CurrentUserId, recipeId, true);
        return ok ? Ok() : NotFound();
    }

    [HttpDelete("selected/{recipeId}")]
    public async Task<IActionResult> RemoveSelected(int recipeId)
    {
        var ok = await _recipeService.ToggleSelectedAsync(CurrentUserId, recipeId, false);
        return ok ? Ok() : NotFound();
    }

    [HttpPost("recipes/{recipeId}/cooked")]
    public async Task<IActionResult> MarkCooked(int recipeId)
    {
        var ok = await _recipeService.MarkCookedAsync(CurrentUserId, recipeId);
        return ok ? Ok() : NotFound();
    }

    // Тижневе меню (за датою): читання діапазону (видимий тиждень) + заміна одного дня.
    [HttpGet("menu")]
    public async Task<IActionResult> GetMenu([FromQuery] string from, [FromQuery] string to)
    {
        if (!DateOnly.TryParse(from, out var f) || !DateOnly.TryParse(to, out var t))
            return BadRequest(new { error = "bad_range" });
        if (f > t || t.DayNumber - f.DayNumber > 370) return BadRequest(new { error = "bad_range" });
        return Ok(await _recipeService.GetMenuRangeAsync(CurrentUserId, f, t));
    }

    [HttpPut("menu/{date}")]
    public async Task<IActionResult> PutMenuDay(string date, [FromBody] PutMenuDayRequest r)
    {
        if (!DateOnly.TryParse(date, out var d)) return BadRequest(new { error = "bad_date" });
        await _recipeService.ReplaceMenuDayAsync(CurrentUserId, d, r.RecipeIds ?? new List<int>());
        return Ok();
    }

    // Підказки для планування меню на конкретну дату: найчастіші страви саме в цей день тижня +
    // найчастіші взагалі (за історією користувача). { byWeekday: [recipeId…], overall: [recipeId…] }.
    [HttpGet("menu/hints")]
    public async Task<IActionResult> GetMenuHints([FromQuery] string date)
    {
        if (!DateOnly.TryParse(date, out var d)) return BadRequest(new { error = "bad_date" });
        return Ok(await _recipeService.GetMenuHintsAsync(CurrentUserId, d));
    }
}
