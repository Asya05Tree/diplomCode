using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Server.Migrations
{
    /// <inheritdoc />
    public partial class ReworkStudyModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GradeScaleEntries");

            migrationBuilder.RenameColumn(
                name: "Room",
                table: "StudySubjects",
                newName: "SeminarRoom");

            migrationBuilder.RenameColumn(
                name: "NameUk",
                table: "StudySubjects",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "NameEn",
                table: "StudySubjects",
                newName: "SeminarLink");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "StudyAssignments",
                newName: "Description");

            migrationBuilder.AddColumn<bool>(
                name: "IsWorking",
                table: "UserProfiles",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "StudentType",
                table: "UserProfiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LectureLink",
                table: "StudySubjects",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LectureRoom",
                table: "StudySubjects",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DeadlineKind",
                table: "StudyAssignments",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<decimal>(
                name: "Grade",
                table: "StudyAssignments",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StudyProjects",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Name = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Curator = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DeadlineKind = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyProjects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudyProjects_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "StudyScheduleEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    EntryKind = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SubjectId = table.Column<int>(type: "int", nullable: true),
                    Name = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    SessionKind = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    PairNumber = table.Column<int>(type: "int", nullable: true),
                    Form = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Room = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Link = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RecurrenceRuleId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyScheduleEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudyScheduleEntries_StudySubjects_SubjectId",
                        column: x => x.SubjectId,
                        principalTable: "StudySubjects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_StudyScheduleEntries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "StudySettings",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    LearningForm = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    TermType = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StudyStart = table.Column<DateOnly>(type: "date", nullable: true),
                    StudyEnd = table.Column<DateOnly>(type: "date", nullable: true),
                    SemesterEnd = table.Column<DateOnly>(type: "date", nullable: true),
                    YearEnd = table.Column<DateOnly>(type: "date", nullable: true),
                    VacationStart = table.Column<DateOnly>(type: "date", nullable: true),
                    VacationEnd = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudySettings", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_StudySettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "StudyProjectSteps",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ProjectId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: true),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IsDone = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudyProjectSteps", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudyProjectSteps_StudyProjects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "StudyProjects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_StudyProjects_UserId",
                table: "StudyProjects",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_StudyProjectSteps_ProjectId",
                table: "StudyProjectSteps",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_StudyScheduleEntries_SubjectId",
                table: "StudyScheduleEntries",
                column: "SubjectId");

            migrationBuilder.CreateIndex(
                name: "IX_StudyScheduleEntries_UserId",
                table: "StudyScheduleEntries",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudyProjectSteps");

            migrationBuilder.DropTable(
                name: "StudyScheduleEntries");

            migrationBuilder.DropTable(
                name: "StudySettings");

            migrationBuilder.DropTable(
                name: "StudyProjects");

            migrationBuilder.DropColumn(
                name: "IsWorking",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "StudentType",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "LectureLink",
                table: "StudySubjects");

            migrationBuilder.DropColumn(
                name: "LectureRoom",
                table: "StudySubjects");

            migrationBuilder.DropColumn(
                name: "DeadlineKind",
                table: "StudyAssignments");

            migrationBuilder.DropColumn(
                name: "Grade",
                table: "StudyAssignments");

            migrationBuilder.RenameColumn(
                name: "SeminarRoom",
                table: "StudySubjects",
                newName: "Room");

            migrationBuilder.RenameColumn(
                name: "SeminarLink",
                table: "StudySubjects",
                newName: "NameEn");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "StudySubjects",
                newName: "NameUk");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "StudyAssignments",
                newName: "Title");

            migrationBuilder.CreateTable(
                name: "GradeScaleEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Label = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MinPercent = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GradeScaleEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GradeScaleEntries_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_GradeScaleEntries_UserId",
                table: "GradeScaleEntries",
                column: "UserId");
        }
    }
}
