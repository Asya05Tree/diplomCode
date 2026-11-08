using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Server.Services;

namespace Server.Controllers;

// [StringLength] на текстових полях → 400 на завеликому рядку (обхід клієнтського maxLength) — ПЛАН P2-2.
public record AddShoppingItemRequest([StringLength(TextLimits.Code)] string Section,
    [StringLength(TextLimits.Name)] string? Category, [StringLength(TextLimits.Name)] string? Text, int? ProductId, int? MedicineId);
public record SetShoppingCategoryRequest([StringLength(TextLimits.Name)] string? Category);
public record CheckShoppingItemRequest(decimal? Price);
public record PlanTripRequest(DateTime? Date);

// planner-spec.md §3.8, spisok-pokupok.md. Список покупок (розділи, підказки, особисті ціни) та
// дії над ним: додати/видалити/відмітити покупку, запланувати похід у магазин.
[ApiController]
[Route("api/shopping-list")]
[Authorize]
public class ShoppingListController : ControllerBase
{
    private readonly ShoppingService _shoppingService;

    public ShoppingListController(ShoppingService shoppingService)
    {
        _shoppingService = shoppingService;
    }

    private int CurrentUserId => User.GetUserId();

    [HttpGet]
    public async Task<IActionResult> GetList()
    {
        var list = await _shoppingService.GetListAsync(CurrentUserId);
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> AddItem([FromBody] AddShoppingItemRequest request)
    {
        var id = await _shoppingService.AddItemAsync(
            CurrentUserId, request.Section, request.Category, request.Text, request.ProductId, request.MedicineId);
        return id is null ? BadRequest(new { error = "invalid_item" }) : Ok(new { id });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _shoppingService.DeleteItemAsync(CurrentUserId, id);
        return ok ? Ok() : NotFound();
    }

    [HttpPut("{id}/category")]
    public async Task<IActionResult> SetCategory(int id, [FromBody] SetShoppingCategoryRequest request)
    {
        var ok = await _shoppingService.SetCategoryAsync(CurrentUserId, id, request.Category);
        return ok ? Ok() : NotFound();
    }

    [HttpPost("{id}/check")]
    public async Task<IActionResult> Check(int id, [FromBody] CheckShoppingItemRequest request)
    {
        var ok = await _shoppingService.CheckItemAsync(CurrentUserId, id, request.Price);
        return ok ? Ok() : NotFound();
    }

    [HttpPost("plan-trip")]
    public async Task<IActionResult> PlanTrip([FromBody] PlanTripRequest? request)
    {
        var taskId = await _shoppingService.PlanTripAsync(CurrentUserId, request?.Date);
        return Ok(new { taskId });
    }
}
