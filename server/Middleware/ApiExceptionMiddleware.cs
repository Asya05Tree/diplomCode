namespace Server.Middleware;

// Перетворює UnauthorizedAccessException (кинутий, напр., CurrentUser.GetUserId при кривому токені)
// на чистий 401 JSON замість 500 зі стеком. Усі інші винятки прокидає далі: у Development їх показує
// детальна сторінка розробника, у Production — глобальний обробник (Program.cs) віддає короткий 500.
public class ApiExceptionMiddleware
{
    private readonly RequestDelegate _next;

    public ApiExceptionMiddleware(RequestDelegate next) => _next = next;

    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (UnauthorizedAccessException)
        {
            if (!ctx.Response.HasStarted)
            {
                ctx.Response.Clear();
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await ctx.Response.WriteAsJsonAsync(new { error = "unauthorized" });
            }
        }
        catch (Server.Authorization.LimitReachedException ex)
        {
            // Досягнуто ліміту записів → 409 з кодом і межею, щоб клієнт показав зрозуміле повідомлення.
            if (!ctx.Response.HasStarted)
            {
                ctx.Response.Clear();
                ctx.Response.StatusCode = StatusCodes.Status409Conflict;
                await ctx.Response.WriteAsJsonAsync(new { error = "record_limit_reached", entity = ex.Entity, limit = ex.Limit });
            }
        }
    }
}
