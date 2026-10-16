using Domain.Enums.Booking;
using Domain.Enums.Hr;

namespace Application.DTOs.Hr;

// Nhân viên, ca tuần, ngày nghỉ (07 §4.3), hoa hồng, lịch của tôi (07 §4.8).

public sealed class StaffMemberDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public StaffKind Kind { get; init; }
    public string Color { get; init; } = string.Empty;
    public string? Specialty { get; init; }
    public Guid? UserId { get; init; }
    public string? Username { get; init; }
    public bool IsActive { get; init; }
    public int SortOrder { get; init; }
    public IReadOnlyList<Guid> ServiceIds { get; init; } = [];

    /// <summary>7 phần tử, Thứ Hai → Chủ nhật.</summary>
    public IReadOnlyList<ShiftType> Shifts { get; init; } = [];
}

public sealed class SaveStaffMemberRequest
{
    public string? Code { get; set; }
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public StaffKind Kind { get; set; }
    public string? Color { get; set; }
    public string? Specialty { get; set; }
    public Guid? UserId { get; set; }
    public List<Guid> ServiceIds { get; set; } = [];

    /// <summary>Không gửi khi tạo KTV mới thì mặc định cả ngày mọi thứ; khi sửa thì giữ nguyên.</summary>
    public List<ShiftType>? Shifts { get; set; }
}

public sealed class UpdateShiftsRequest
{
    public List<ShiftType> Shifts { get; set; } = [];
}

public sealed record AccountCandidate(Guid Id, string Username, string FullName, IReadOnlyList<string> Roles, Guid? LinkedStaffId, string? LinkedStaffName);

public sealed class DayOffDto
{
    public Guid Id { get; init; }
    public Guid? StaffMemberId { get; init; }
    public string? StaffName { get; init; }
    public DateOnly Date { get; init; }
    public string Reason { get; init; } = string.Empty;
}

public sealed class DayOffQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
}

public sealed class CreateDayOffRequest
{
    public Guid? StaffMemberId { get; set; }
    public DateOnly? Date { get; set; }
    public string? Reason { get; set; }
}

public sealed class CommissionRowDto
{
    public Guid? StaffMemberId { get; init; }
    public string? StaffCode { get; init; }
    public string? StaffName { get; init; }
    public int ServiceCount { get; init; }
    public decimal ServiceBase { get; init; }
    public decimal ServiceCommission { get; init; }
    public int PackageCount { get; init; }
    public decimal PackageCommission { get; init; }
    public decimal Total { get; init; }
}

public sealed class CommissionSheetDto
{
    public string Month { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public CommissionPeriodStatus Status { get; init; }
    public DateTime? ClosedAt { get; init; }
    public string? ClosedByName { get; init; }
    public DateTime? PaidAt { get; init; }
    public string? PaidByName { get; init; }
    public bool CanClose { get; init; }
    public string? CloseBlockedReason { get; init; }
    public IReadOnlyList<CommissionRowDto> Rows { get; init; } = [];
    public CommissionRowDto Totals { get; init; } = new();
}

public sealed class CommissionItemDto
{
    public Guid Id { get; init; }
    public DateTime EarnedAt { get; init; }
    public Guid InvoiceId { get; init; }
    public string InvoiceCode { get; init; } = string.Empty;
    public Guid? AppointmentId { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public CommissionKind Kind { get; init; }
    public string Description { get; init; } = string.Empty;
    public decimal BaseAmount { get; init; }
    public CommissionType RateType { get; init; }
    public decimal RateValue { get; init; }
    public decimal Amount { get; init; }
}

public sealed class CommissionItemsQuery
{
    public string? Month { get; set; }
    public Guid StaffMemberId { get; set; }
}

public sealed class MonthQuery
{
    public string? Month { get; set; }
}

public sealed class MyCommissionsDto
{
    public string Month { get; init; } = string.Empty;
    public CommissionPeriodStatus Status { get; init; }
    public decimal Total { get; init; }
    public decimal ServiceCommission { get; init; }
    public decimal PackageCommission { get; init; }
    public IReadOnlyList<CommissionItemDto> Items { get; init; } = [];
}

public sealed class MyScheduleItemDto
{
    public Guid AppointmentId { get; init; }
    public string AppointmentCode { get; init; } = string.Empty;
    public AppointmentStatus Status { get; init; }
    public Guid LineId { get; init; }
    public DateTime StartAt { get; init; }
    public DateTime EndAt { get; init; }
    public string ServiceName { get; init; } = string.Empty;
    public string CustomerName { get; init; } = string.Empty;
    public string? CustomerNote { get; init; }
    public string? AppointmentNote { get; init; }
}

public sealed class MyScheduleDto
{
    public Guid StaffMemberId { get; init; }
    public string StaffName { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public ShiftType Shift { get; init; }
    public int? ShiftStart { get; init; }
    public int? ShiftEnd { get; init; }
    public string? OffReason { get; init; }
    public IReadOnlyList<MyScheduleItemDto> Items { get; init; } = [];
}

public sealed class DateQuery
{
    public string? Date { get; set; }
}
