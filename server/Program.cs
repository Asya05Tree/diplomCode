using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Server.Data;
using Server.Services;

// За замовчуванням ASP.NET перейменовує claim "sub" на ClaimTypes.NameIdentifier — вимикаємо,
// щоб у контролерах читати claim саме як "sub", як його видає JwtService
System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<TaskService>();
builder.Services.AddScoped<RecipeService>();
builder.Services.AddScoped<MedicineService>();
builder.Services.AddScoped<ShoppingService>();
builder.Services.AddScoped<FinanceService>();
builder.Services.AddScoped<CycleService>();
builder.Services.AddScoped<StudyService>();

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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
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
// (також import-forms|import-ingredients|import-medicines|import-interactions).
// Виконуємо імпортери в одному scope і виходимо БЕЗ старту веб-хоста.
var importCommands = new[] { "import-all", "import-forms", "import-ingredients", "import-medicines", "import-interactions" };
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

app.UseCors(DevClientPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
