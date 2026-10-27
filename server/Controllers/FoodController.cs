using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

public record SetStockStateRequest(string State); // Available | RunningLow | OutOfStock

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

    private int CurrentUserId => int.Parse(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value);

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var overview = await _recipeService.GetOverviewAsync(CurrentUserId);
        return Ok(overview);
    }

    [HttpPut("stock/{productId}")]
    public async Task<IActionResult> SetStock(int productId, [FromBody] SetStockStateRequest request)
    {
        var ok = await _recipeService.SetStockStateAsync(CurrentUserId, productId, request.State);
        return ok ? Ok() : BadRequest(new { error = "invalid_stock" });
    }

    [HttpPost("stock/{productId}")]
    public async Task<IActionResult> AddStock(int productId)
    {
        var ok = await _recipeService.AddStockAsync(CurrentUserId, productId);
        return ok ? Ok() : NotFound();
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
}
