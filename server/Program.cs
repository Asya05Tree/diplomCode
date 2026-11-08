using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Server.Data;
using Server.Middleware;
using Server.Services;

// За замовчуванням ASP.NET перейменовує claim "sub" на ClaimTypes.NameIdentifier — вимикаємо,
// щоб у контролерах читати claim саме як "sub", як його видає JwtService
System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // Унікальний schemaId за повним імʼям типу: два вкладені типи з однаковою назвою
    // (WorkService.Recurrence і StudyService.Recurrence) інакше дають колізію й падіння
    // генерації swagger.json у 500 (ПЛАН P3-6). "+" у вкладених типах → "." для читабельності.
    c.CustomSchemaIds(t => t.FullName?.Replace("+", "."));
});

builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<TaskService>();
builder.Services.AddScoped<RecipeService>();
builder.Services.AddScoped<MedicineService>();
builder.Services.AddScoped<ShoppingService>();
builder.Services.AddScoped<FinanceService>();
builder.Services.AddScoped<CycleService>();
builder.Services.AddScoped<StudyService>();
builder.Services.AddScoped<WorkService>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<CheckupService>();
builder.Services.AddScoped<VaccinationService>();
builder.Services.AddScoped<BillingService>();

// Вихідні запити до платіжки WayForPay (перевірка статусу замовлення)
builder.Services.AddHttpClient();

// Фонове видалення акаунтів, неактивних понад рік
builder.Services.AddHostedService<InactiveAccountCleanupService>();

// JWT-ключ береться ТІЛЬКИ з конфігу середовища (User Secrets / appsettings.Development.json /
// змінна Jwt__Key) — у коміченому appsettings.json його немає навмисно. Якщо ключа немає або він
// закороткий — одразу падаємо, щоб слабкий/плейсхолдерний ключ ніколи не доїхав до продакшену.
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException(
        "Jwt:Key не налаштовано або закороткий (потрібно ≥ 32 байти). Задайте його через User Secrets " +
        "або змінну середовища Jwt__Key (приклад — appsettings.Development.json.example).");

// Мок-білінг «оплачує» фічу без реальних грошей — припустимо лише локально. У продакшені це дірка
// в монетизації, тож забороняємо старт із Mock=true поза Development.
if (builder.Environment.IsProduction() && builder.Configuration.GetValue("Billing:Mock", false))
    throw new InvalidOperationException("Billing:Mock=true заборонено у Production (безкоштовне розблокування платної фічі).");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
        // Відкликання токена (ПЛАН P2-1): підпис і термін дії вже перевірено вище, тут додатково
        // звіряємо версію з claim "tver" із поточною в БД. Після "Вийти"/видалення акаунта версія
        // змінюється (або рядок зникає) — старий токен тут відпадає у 401, а не працює до exp.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async ctx =>
            {
                var sub = ctx.Principal?.FindFirst("sub")?.Value;
                var tver = ctx.Principal?.FindFirst("tver")?.Value;
                if (!int.TryParse(sub, out var userId) || !int.TryParse(tver, out var tokenVersion))
                {
                    ctx.Fail("invalid_token");
                    return;
                }
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var current = await db.Users
                    .Where(u => u.Id == userId)
                    .Select(u => (int?)u.TokenVersion)
                    .FirstOrDefaultAsync();
                if (current is null || current.Value != tokenVersion)
                    ctx.Fail("token_revoked");
            },
        };
    });

// Рядок підключення береться з appsettings.{Environment}.json (ключ ConnectionStrings:Default)
var connectionString = builder.Configuration.GetConnectionString("Default");
// Версія фіксована (не ServerVersion.AutoDetect), інакше dotnet ef migrations намагається
// підʼєднатись до реальної MySQL ще на етапі побудови моделі — і падає, якщо Docker не піднятий
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0))));

// Фронтенд (Vite dev-сервер) звертається з іншого порту — дозволяємо це тільки для розробки
const string DevClientPolicy = "DevClient";
builder.Services.AddCors(options =>
{
    options.AddPolicy(DevClientPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// CLI-режим імпорту довідкових даних (Phase 2). Запуск: dotnet run -- import-all
// (також import-forms|import-ingredients|import-medicines|import-interactions|dedup-medicines).
// Виконуємо імпортери в одному scope і виходимо БЕЗ старту веб-хоста.
var importCommands = new[] { "import-all", "import-forms", "import-ingredients", "import-medicines", "import-interactions", "dedup-medicines", "import-vaccines" };
var importArg = args.FirstOrDefault(a => importCommands.Contains(a));
if (importArg != null)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<Server.Data.AppDbContext>();
    Server.DataImport.ImportRunner.Run(db, importArg);
    return;
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    // У Production необроблені винятки віддаємо коротким JSON без stack trace (витік внутрішньої
    // структури). У Development лишається детальна сторінка розробника (додається автоматично).
    app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
    {
        ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new { error = "internal_error" });
    }));
}

// Кривий токен (валідний підпис, але без sub) → 401 JSON замість 500. Решту винятків прокидає далі.
app.UseMiddleware<ApiExceptionMiddleware>();

app.UseCors(DevClientPolicy);
app.UseAuthentication();
app.UseAuthorization();

// Відстеження активності: для автентифікованих запитів оновлюємо LastActiveAt не частіше ніж раз на
// добу (один дешевий UPDATE, що здебільшого зачіпає 0 рядків). За цим полем фонова служба видаляє
// акаунти, неактивні понад рік.
app.Use(async (ctx, next) =>
{
    var sub = ctx.User.FindFirst("sub")?.Value;
    if (sub != null && int.TryParse(sub, out var userId))
    {
        var db = ctx.RequestServices.GetRequiredService<Server.Data.AppDbContext>();
        var since = DateTime.UtcNow.Date;
        await db.Users
            .Where(u => u.Id == userId && u.LastActiveAt < since)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastActiveAt, DateTime.UtcNow));
    }
    await next();
});

app.MapControllers();

app.Run();
