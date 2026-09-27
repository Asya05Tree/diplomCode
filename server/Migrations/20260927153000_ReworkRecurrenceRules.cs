using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class ReworkRecurrenceRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Pattern",
                table: "RecurrenceRules",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "DaysOfWeek",
                table: "RecurrenceRules",
                newName: "WeekDaysPattern");

            migrationBuilder.AddColumn<DateOnly>(
                name: "CycleAnchorDate",
                table: "RecurrenceRules",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CycleWeeks",
                table: "RecurrenceRules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "IntervalDays",
                table: "RecurrenceRules",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MonthDayMode",
                table: "RecurrenceRules",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "MonthDays",
                table: "RecurrenceRules",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ManualRecurrenceDates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    RecurrenceRuleId = table.Column<int>(type: "int", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ManualRecurrenceDates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ManualRecurrenceDates_RecurrenceRules_RecurrenceRuleId",
                        column: x => x.RecurrenceRuleId,
                        principalTable: "RecurrenceRules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ManualRecurrenceDates_RecurrenceRuleId",
                table: "ManualRecurrenceDates",
                column: "RecurrenceRuleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ManualRecurrenceDates");

            migrationBuilder.DropColumn(
                name: "CycleAnchorDate",
                table: "RecurrenceRules");

            migrationBuilder.DropColumn(
                name: "CycleWeeks",
                table: "RecurrenceRules");

            migrationBuilder.DropColumn(
                name: "IntervalDays",
                table: "RecurrenceRules");

            migrationBuilder.DropColumn(
                name: "MonthDayMode",
                table: "RecurrenceRules");

            migrationBuilder.DropColumn(
                name: "MonthDays",
                table: "RecurrenceRules");

            migrationBuilder.RenameColumn(
                name: "WeekDaysPattern",
                table: "RecurrenceRules",
                newName: "DaysOfWeek");

            migrationBuilder.RenameColumn(
                name: "Type",
                table: "RecurrenceRules",
                newName: "Pattern");
        }
    }
}
