using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Server.Data;

namespace Server.Authorization;

// Серверний гейтинг умовних модулів (planner-spec.md §2.4: "вимкнений модуль не з'являється ніде").
// Приховування вкладок на клієнті — лише косметика; справжня перевірка має бути на сервері, інакше
// будь-хто з токеном робить CRUD на чужому за профілем модулі. Вішається на контролер поряд із
// [Authorize]: [RequireModule("study"|"work"|"cycle")]. Доступ визначається профілем користувача.
[AttributeUsage(AttributeTargets.Class)]
public class RequireModuleAttribute : Attribute, IAsyncAuthorizationFilter
{
    private readonly string _module;

    public RequireModuleAttribute(string module) => _module = module;

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // Фільтр спрацьовує вже після автентифікації ([Authorize] дає 401 без токена раніше).
        // Нечитабельний/відсутній sub трактуємо як 401, а не падаємо у 500.
        var sub = context.HttpContext.User.FindFirst("sub")?.Value;
        if (!int.TryParse(sub, out var userId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var profile = await db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId);

        var enabled = _module switch
        {
            "study" => profile?.StudentType is "pupil" or "student",
            "work" => profile?.IsWorking == true,
            "cycle" => string.Equals(profile?.Gender, "female", StringComparison.OrdinalIgnoreCase),
            _ => false,
        };

        if (!enabled) context.Result = new ForbidResult();   // 403: модуль не належить користувачу
    }
}
