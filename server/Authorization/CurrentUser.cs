using System.Security.Claims;

namespace Server.Authorization;

// Єдина точка читання Id користувача з токена. Раніше контролери робили
// int.Parse(User.FindFirst("sub")!.Value) — і валідний за підписом, але кривий токен (без sub або
// з нечисловим sub) валив запит у 500. Тепер такий випадок — це 401 (див. ApiExceptionMiddleware).
public static class CurrentUser
{
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var sub = user.FindFirst("sub")?.Value;
        if (!int.TryParse(sub, out var id))
            throw new UnauthorizedAccessException("missing_or_invalid_sub");
        return id;
    }
}
