using Microsoft.EntityFrameworkCore;
using Server.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

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

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(DevClientPolicy);
app.UseAuthorization();
app.MapControllers();

app.Run();
