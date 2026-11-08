using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDeadColumnsWorkPayTodo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TodoItems");

            // Спершу переводимо FullName у varchar(255) і створюємо новий індекс (UserId, FullName),
            // і лише тоді дропаємо старий (UserId, GroupName). Інакше MySQL блокує дроп: старий індекс
            // підпирає FK на UserId, і без заміни FK лишився б без підтримувального індексу.
            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                table: "WorkContacts",
                type: "varchar(255)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_WorkContacts_UserId_FullName",
                table: "WorkContacts",
                columns: new[] { "UserId", "FullName" });

            migrationBuilder.DropIndex(
                name: "IX_WorkContacts_UserId_GroupName",
                table: "WorkContacts");

            migrationBuilder.DropColumn(
                name: "ExtraVacationDays",
                table: "WorkSettings");

            migrationBuilder.DropColumn(
                name: "FullRateRetained",
                table: "WorkSettings");

            migrationBuilder.DropColumn(
                name: "NormHours",
                table: "WorkSettings");

            migrationBuilder.DropColumn(
                name: "PayType",
                table: "WorkSettings");

            migrationBuilder.DropColumn(
                name: "Rate",
                table: "WorkSettings");

            migrationBuilder.DropColumn(
                name: "Regime",
                table: "WorkSettings");

            migrationBuilder.DropColumn(
                name: "Workplace",
                table: "WorkSettings");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "WorkObligations");

            migrationBuilder.DropColumn(
                name: "IsDone",
                table: "WorkObligations");

            migrationBuilder.DropColumn(
                name: "GroupName",
                table: "WorkContacts");

            migrationBuilder.DropColumn(
                name: "Socials",
                table: "WorkContacts");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "WorkContacts");

            migrationBuilder.DropColumn(
                name: "Viber",
                table: "WorkContacts");

            migrationBuilder.DropColumn(
                name: "HistoryRetentionDays",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "AddedAt",
                table: "UserMedicines");

            migrationBuilder.DropColumn(
                name: "IsPinned",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "StockItems");

            migrationBuilder.DropColumn(
                name: "CheckedAt",
                table: "ShoppingItems");

            migrationBuilder.DropColumn(
                name: "AddedAt",
                table: "SelectedDishes");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Medicines");

            migrationBuilder.DropColumn(
                name: "IsOtc",
                table: "Medicines");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "FinanceAccounts");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WorkContacts_UserId_FullName",
                table: "WorkContacts");

            migrationBuilder.AddColumn<int>(
                name: "ExtraVacationDays",
                table: "WorkSettings",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "FullRateRetained",
                table: "WorkSettings",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "NormHours",
                table: "WorkSettings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PayType",
                table: "WorkSettings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "Rate",
                table: "WorkSettings",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Regime",
                table: "WorkSettings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Workplace",
                table: "WorkSettings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                table: "WorkObligations",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDone",
                table: "WorkObligations",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                table: "WorkContacts",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(255)")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "GroupName",
                table: "WorkContacts",
                type: "varchar(255)",
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Socials",
                table: "WorkContacts",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "WorkContacts",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Viber",
                table: "WorkContacts",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "HistoryRetentionDays",
                table: "UserProfiles",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "AddedAt",
                table: "UserMedicines",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<bool>(
                name: "IsPinned",
                table: "Tasks",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "StockItems",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckedAt",
                table: "ShoppingItems",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AddedAt",
                table: "SelectedDishes",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Notes",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "Medicines",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsOtc",
                table: "Medicines",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "FinanceAccounts",
                type: "datetime(6)",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "TodoItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(255)", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Text = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TodoItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TodoItems_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_WorkContacts_UserId_GroupName",
                table: "WorkContacts",
                columns: new[] { "UserId", "GroupName" });

            migrationBuilder.CreateIndex(
                name: "IX_TodoItems_UserId_Status_OrderIndex",
                table: "TodoItems",
                columns: new[] { "UserId", "Status", "OrderIndex" });
        }
    }
}
