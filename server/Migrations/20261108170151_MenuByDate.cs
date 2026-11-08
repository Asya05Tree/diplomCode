using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class MenuByDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Нова колонка спершу nullable — щоб заповнити наявні рядки бекфілом і не втратити меню.
            migrationBuilder.AddColumn<DateOnly>(
                name: "MenuDate",
                table: "FoodMenuItems",
                type: "date",
                nullable: true);

            // Бекфіл: наявні записи (кейовані за днем тижня) прив'язуємо до ПОТОЧНОГО тижня —
            // понеділок цього тижня + (DayOfWeek-1) днів. Меню не губиться, лише «осідає» на цей тиждень.
            migrationBuilder.Sql(
                "UPDATE `FoodMenuItems` " +
                "SET `MenuDate` = DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), " +
                "INTERVAL (`DayOfWeek` - 1) DAY);");

            // Тепер колонка обов'язкова.
            migrationBuilder.AlterColumn<DateOnly>(
                name: "MenuDate",
                table: "FoodMenuItems",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);

            // Новий індекс СТВОРЮЄМО ДО дропу старого: його префікс UserId покриває FK на Users,
            // інакше MySQL не дає дропнути старий індекс ("needed in a foreign key constraint").
            migrationBuilder.CreateIndex(
                name: "IX_FoodMenuItems_UserId_MenuDate_Position",
                table: "FoodMenuItems",
                columns: new[] { "UserId", "MenuDate", "Position" });

            migrationBuilder.DropIndex(
                name: "IX_FoodMenuItems_UserId_DayOfWeek_Position",
                table: "FoodMenuItems");

            migrationBuilder.DropColumn(
                name: "DayOfWeek",
                table: "FoodMenuItems");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FoodMenuItems_UserId_MenuDate_Position",
                table: "FoodMenuItems");

            migrationBuilder.DropColumn(
                name: "MenuDate",
                table: "FoodMenuItems");

            migrationBuilder.AddColumn<int>(
                name: "DayOfWeek",
                table: "FoodMenuItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_FoodMenuItems_UserId_DayOfWeek_Position",
                table: "FoodMenuItems",
                columns: new[] { "UserId", "DayOfWeek", "Position" });
        }
    }
}
