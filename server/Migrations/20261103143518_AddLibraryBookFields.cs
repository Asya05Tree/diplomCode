using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryBookFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsLibrary",
                table: "MediaItems",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsReturned",
                table: "MediaItems",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReturnDeadline",
                table: "MediaItems",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReturnTaskId",
                table: "MediaItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StatusBeforeReturn",
                table: "MediaItems",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsLibrary",
                table: "MediaItems");

            migrationBuilder.DropColumn(
                name: "IsReturned",
                table: "MediaItems");

            migrationBuilder.DropColumn(
                name: "ReturnDeadline",
                table: "MediaItems");

            migrationBuilder.DropColumn(
                name: "ReturnTaskId",
                table: "MediaItems");

            migrationBuilder.DropColumn(
                name: "StatusBeforeReturn",
                table: "MediaItems");
        }
    }
}
