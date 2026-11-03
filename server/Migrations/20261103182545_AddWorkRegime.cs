using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkRegime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "EndTime2",
                table: "WorkShiftTypes",
                type: "time(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "WorkShiftTypes",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "OnCallMultiplier",
                table: "WorkShiftTypes",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "StartTime2",
                table: "WorkShiftTypes",
                type: "time(6)",
                nullable: true);

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndTime2",
                table: "WorkShiftTypes");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "WorkShiftTypes");

            migrationBuilder.DropColumn(
                name: "OnCallMultiplier",
                table: "WorkShiftTypes");

            migrationBuilder.DropColumn(
                name: "StartTime2",
                table: "WorkShiftTypes");

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
                name: "Regime",
                table: "WorkSettings");

            migrationBuilder.DropColumn(
                name: "Workplace",
                table: "WorkSettings");
        }
    }
}
