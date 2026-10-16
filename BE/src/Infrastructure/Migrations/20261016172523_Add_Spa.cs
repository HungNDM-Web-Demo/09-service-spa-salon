using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Spa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Booking_BusinessHours",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OpenMinute = table.Column<int>(type: "integer", nullable: false),
                    CloseMinute = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_BusinessHours", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Booking_ServiceGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsVisible = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_ServiceGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Crm_Customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Phone = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    FullName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    BirthDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Gender = table.Column<int>(type: "integer", nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Crm_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Hr_CommissionPeriods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PaidByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hr_CommissionPeriods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Hr_StaffMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    FullName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    Specialty = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hr_StaffMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Hr_StaffMembers_System_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "System_Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Booking_Services",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    GroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    CleanupMinutes = table.Column<int>(type: "integer", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    AllowOnline = table.Column<bool>(type: "boolean", nullable: false),
                    CommissionType = table.Column<int>(type: "integer", nullable: false),
                    CommissionValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    IsVisible = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_Services", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_Services_Booking_ServiceGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "Booking_ServiceGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Booking_Appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    StartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ConfirmedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ConfirmedByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CheckedInAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CheckedInByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CancelReason = table.Column<int>(type: "integer", nullable: true),
                    CancelNote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    NoShowAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NoShowByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReminderSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_Appointments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_Appointments_Crm_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Crm_Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Hr_Commissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffMemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    InvoiceCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CustomerName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    EarnedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BaseAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RateType = table.Column<int>(type: "integer", nullable: false),
                    RateValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hr_Commissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Hr_Commissions_Hr_StaffMembers_StaffMemberId",
                        column: x => x.StaffMemberId,
                        principalTable: "Hr_StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Hr_DaysOff",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffMemberId = table.Column<Guid>(type: "uuid", nullable: true),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Reason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hr_DaysOff", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Hr_DaysOff_Hr_StaffMembers_StaffMemberId",
                        column: x => x.StaffMemberId,
                        principalTable: "Hr_StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Hr_WeeklyShifts",
                columns: table => new
                {
                    StaffMemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    Shift = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hr_WeeklyShifts", x => new { x.StaffMemberId, x.DayOfWeek });
                    table.ForeignKey(
                        name: "FK_Hr_WeeklyShifts_Hr_StaffMembers_StaffMemberId",
                        column: x => x.StaffMemberId,
                        principalTable: "Hr_StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Booking_PackageTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sessions = table.Column<int>(type: "integer", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ValidityMonths = table.Column<int>(type: "integer", nullable: false),
                    MinIntervalDays = table.Column<int>(type: "integer", nullable: false),
                    CommissionRate = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_PackageTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_PackageTemplates_Booking_Services_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "Booking_Services",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Hr_StaffServices",
                columns: table => new
                {
                    StaffMemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hr_StaffServices", x => new { x.StaffMemberId, x.ServiceId });
                    table.ForeignKey(
                        name: "FK_Hr_StaffServices_Booking_Services_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "Booking_Services",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Hr_StaffServices_Hr_StaffMembers_StaffMemberId",
                        column: x => x.StaffMemberId,
                        principalTable: "Hr_StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Booking_AppointmentLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    CleanupMinutes = table.Column<int>(type: "integer", nullable: false),
                    StaffMemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_AppointmentLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_AppointmentLines_Booking_Appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "Booking_Appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Booking_AppointmentLines_Booking_Services_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "Booking_Services",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Booking_AppointmentLines_Hr_StaffMembers_StaffMemberId",
                        column: x => x.StaffMemberId,
                        principalTable: "Hr_StaffMembers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Booking_AppointmentMessages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Channel = table.Column<int>(type: "integer", nullable: false),
                    Content = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_AppointmentMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_AppointmentMessages_Booking_Appointments_Appointmen~",
                        column: x => x.AppointmentId,
                        principalTable: "Booking_Appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Booking_Invoices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    PaidAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CashierName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ServiceTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PackageTotal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountType = table.Column<int>(type: "integer", nullable: true),
                    DiscountValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DiscountReason = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Total = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Method = table.Column<int>(type: "integer", nullable: false),
                    CashReceived = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ChangeAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CardAuthCode = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: true),
                    IntervalOverrideReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CancelReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ClientRequestId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_Invoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_Invoices_Booking_Appointments_AppointmentId",
                        column: x => x.AppointmentId,
                        principalTable: "Booking_Appointments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Booking_Invoices_Crm_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Crm_Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Booking_CustomerPackages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    PackageTemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    PackageName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TotalSessions = table.Column<int>(type: "integer", nullable: false),
                    UsedSessions = table.Column<int>(type: "integer", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    SessionValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MinIntervalDays = table.Column<int>(type: "integer", nullable: false),
                    CommissionRate = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    PurchasedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExtendedDays = table.Column<int>(type: "integer", nullable: true),
                    ExtendReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ExtendedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExtendedByName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ConsultantStaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    ConsultantName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_CustomerPackages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_CustomerPackages_Booking_PackageTemplates_PackageTe~",
                        column: x => x.PackageTemplateId,
                        principalTable: "Booking_PackageTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Booking_CustomerPackages_Crm_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Crm_Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Booking_InvoiceLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    AppointmentLineId = table.Column<Guid>(type: "uuid", nullable: true),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    PackageTemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    CustomerPackageId = table.Column<Guid>(type: "uuid", nullable: true),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StaffMemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    ListPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UsesPackage = table.Column<bool>(type: "boolean", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BasePrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    PackageCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    PackageRemaining = table.Column<int>(type: "integer", nullable: true),
                    PackageExpiryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_InvoiceLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_InvoiceLines_Booking_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Booking_Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Booking_PackageUsages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerPackageId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppointmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    AppointmentCode = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StaffMemberId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    OverrideReason = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Refunded = table.Column<bool>(type: "boolean", nullable: false),
                    RefundedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Booking_PackageUsages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Booking_PackageUsages_Booking_CustomerPackages_CustomerPack~",
                        column: x => x.CustomerPackageId,
                        principalTable: "Booking_CustomerPackages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Booking_AppointmentLines_AppointmentId",
                table: "Booking_AppointmentLines",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_AppointmentLines_ServiceId",
                table: "Booking_AppointmentLines",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_AppointmentLines_StaffMemberId_StartAt",
                table: "Booking_AppointmentLines",
                columns: new[] { "StaffMemberId", "StartAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Booking_AppointmentMessages_AppointmentId",
                table: "Booking_AppointmentMessages",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Appointments_Code",
                table: "Booking_Appointments",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Appointments_CustomerId_StartAt",
                table: "Booking_Appointments",
                columns: new[] { "CustomerId", "StartAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Appointments_Date",
                table: "Booking_Appointments",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_CustomerPackages_Code",
                table: "Booking_CustomerPackages",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Booking_CustomerPackages_CustomerId_ServiceId",
                table: "Booking_CustomerPackages",
                columns: new[] { "CustomerId", "ServiceId" });

            migrationBuilder.CreateIndex(
                name: "IX_Booking_CustomerPackages_InvoiceId",
                table: "Booking_CustomerPackages",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_CustomerPackages_PackageTemplateId",
                table: "Booking_CustomerPackages",
                column: "PackageTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_InvoiceLines_AppointmentLineId",
                table: "Booking_InvoiceLines",
                column: "AppointmentLineId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_InvoiceLines_CustomerPackageId",
                table: "Booking_InvoiceLines",
                column: "CustomerPackageId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_InvoiceLines_InvoiceId",
                table: "Booking_InvoiceLines",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Invoices_AppointmentId",
                table: "Booking_Invoices",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Invoices_ClientRequestId",
                table: "Booking_Invoices",
                column: "ClientRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Invoices_Code",
                table: "Booking_Invoices",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Invoices_CustomerId",
                table: "Booking_Invoices",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Invoices_PaidAt",
                table: "Booking_Invoices",
                column: "PaidAt");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_PackageTemplates_Code",
                table: "Booking_PackageTemplates",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Booking_PackageTemplates_ServiceId",
                table: "Booking_PackageTemplates",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_PackageUsages_CustomerPackageId",
                table: "Booking_PackageUsages",
                column: "CustomerPackageId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_PackageUsages_InvoiceId",
                table: "Booking_PackageUsages",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Booking_ServiceGroups_Name",
                table: "Booking_ServiceGroups",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Services_Code",
                table: "Booking_Services",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Booking_Services_GroupId",
                table: "Booking_Services",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Crm_Customers_Code",
                table: "Crm_Customers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Crm_Customers_Phone",
                table: "Crm_Customers",
                column: "Phone",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hr_CommissionPeriods_Code",
                table: "Hr_CommissionPeriods",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hr_CommissionPeriods_Month",
                table: "Hr_CommissionPeriods",
                column: "Month",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hr_Commissions_InvoiceId",
                table: "Hr_Commissions",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Hr_Commissions_Month_StaffMemberId",
                table: "Hr_Commissions",
                columns: new[] { "Month", "StaffMemberId" });

            migrationBuilder.CreateIndex(
                name: "IX_Hr_Commissions_StaffMemberId",
                table: "Hr_Commissions",
                column: "StaffMemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Hr_DaysOff_Date",
                table: "Hr_DaysOff",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_Hr_DaysOff_StaffMemberId_Date",
                table: "Hr_DaysOff",
                columns: new[] { "StaffMemberId", "Date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hr_StaffMembers_Code",
                table: "Hr_StaffMembers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hr_StaffMembers_UserId",
                table: "Hr_StaffMembers",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Hr_StaffServices_ServiceId",
                table: "Hr_StaffServices",
                column: "ServiceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Booking_AppointmentLines");

            migrationBuilder.DropTable(
                name: "Booking_AppointmentMessages");

            migrationBuilder.DropTable(
                name: "Booking_BusinessHours");

            migrationBuilder.DropTable(
                name: "Booking_InvoiceLines");

            migrationBuilder.DropTable(
                name: "Booking_PackageUsages");

            migrationBuilder.DropTable(
                name: "Hr_CommissionPeriods");

            migrationBuilder.DropTable(
                name: "Hr_Commissions");

            migrationBuilder.DropTable(
                name: "Hr_DaysOff");

            migrationBuilder.DropTable(
                name: "Hr_StaffServices");

            migrationBuilder.DropTable(
                name: "Hr_WeeklyShifts");

            migrationBuilder.DropTable(
                name: "Booking_Invoices");

            migrationBuilder.DropTable(
                name: "Booking_CustomerPackages");

            migrationBuilder.DropTable(
                name: "Hr_StaffMembers");

            migrationBuilder.DropTable(
                name: "Booking_Appointments");

            migrationBuilder.DropTable(
                name: "Booking_PackageTemplates");

            migrationBuilder.DropTable(
                name: "Crm_Customers");

            migrationBuilder.DropTable(
                name: "Booking_Services");

            migrationBuilder.DropTable(
                name: "Booking_ServiceGroups");
        }
    }
}
