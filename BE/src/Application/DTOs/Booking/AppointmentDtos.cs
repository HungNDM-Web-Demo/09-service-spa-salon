using Application.Common.Models;
using Application.DTOs.Crm;
using Domain.Enums.Booking;
using Domain.Enums.Hr;

namespace Application.DTOs.Booking;

// Lịch hẹn, lưới, kiểm tra bản nháp, gợi ý (07 §4.4, §5).

public sealed record IssueDto(string Code, string Message);

public sealed class AppointmentLineDto
{
    public Guid Id { get; init; }
    public Guid ServiceId { get; init; }
    public string ServiceName { get; init; } = string.Empty;
    public Guid StaffMemberId { get; init; }
    public string StaffName { get; init; } = string.Empty;
    public string StaffColor { get; init; } = string.Empty;
    public DateTime StartAt { get; init; }
    public DateTime EndAt { get; init; }
    public int DurationMinutes { get; init; }
    public int CleanupMinutes { get; init; }
    public decimal Price { get; init; }
    public int SortOrder { get; init; }
}

public class AppointmentCardDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public AppointmentStatus Status { get; init; }
    public AppointmentSource Source { get; init; }
    public Guid CustomerId { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public string CustomerPhone { get; init; } = string.Empty;
    public bool IsFlagged { get; init; }
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? CheckedInAt { get; init; }
    public DateTime StartAt { get; init; }
    public DateTime EndAt { get; init; }
    public bool IsLate { get; init; }
    public bool PendingOverdue { get; init; }
    public IReadOnlyList<AppointmentLineDto> Lines { get; init; } = [];
}

public sealed class BoardTechnicianDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public ShiftType? Shift { get; init; }
    public int? ShiftStart { get; init; }
    public int? ShiftEnd { get; init; }
    public string? OffReason { get; init; }
    public IReadOnlyList<Guid> ServiceIds { get; init; } = [];
}

public sealed class BoardDto
{
    public DateOnly Date { get; init; }
    public int OpenMinute { get; init; }
    public int CloseMinute { get; init; }
    public string? ShopClosedReason { get; init; }
    public IReadOnlyList<BoardTechnicianDto> Technicians { get; init; } = [];
    public IReadOnlyList<AppointmentCardDto> Appointments { get; init; } = [];
}

public sealed class AppointmentActionsDto
{
    public bool CanEdit { get; init; }
    public bool CanConfirm { get; init; }
    public bool CanReject { get; init; }
    public bool CanCancel { get; init; }
    public bool CanCheckIn { get; init; }
    public bool CanNoShow { get; init; }
    public bool CanCheckout { get; init; }
}

public sealed record MessageDto(Guid Id, MessageKind Kind, MessageChannel Channel, string Content, DateTime SentAt);

public sealed record InvoiceBrief(
    Guid Id,
    string Code,
    DateTime PaidAt,
    decimal Total,
    PaymentMethod Method,
    InvoiceStatus Status,
    bool CanCancel,
    string? CancelBlockedReason);

public sealed class AppointmentDetailDto : AppointmentCardDto
{
    public DateOnly Date { get; init; }
    public CustomerDto Customer { get; init; } = new();
    public IReadOnlyList<CustomerPackageBrief> Packages { get; init; } = [];
    public string? CreatedByName { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public string? ConfirmedByName { get; init; }
    public string? CheckedInByName { get; init; }
    public CancelReason? CancelReason { get; init; }
    public string? CancelNote { get; init; }
    public DateTime? CancelledAt { get; init; }
    public string? CancelledByName { get; init; }
    public DateTime? NoShowAt { get; init; }
    public string? NoShowByName { get; init; }
    public DateTime? CompletedAt { get; init; }
    public IReadOnlyList<MessageDto> Messages { get; init; } = [];
    public IReadOnlyList<InvoiceBrief> Invoices { get; init; } = [];
    public AppointmentActionsDto Actions { get; init; } = new();
}

public sealed class AppointmentListItem
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public DateOnly Date { get; init; }
    public DateTime StartAt { get; init; }
    public DateTime EndAt { get; init; }
    public AppointmentStatus Status { get; init; }
    public AppointmentSource Source { get; init; }
    public Guid CustomerId { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public string CustomerPhone { get; init; } = string.Empty;
    public string Services { get; init; } = string.Empty;
    public string StaffNames { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class AppointmentQuery : PaginationQuery
{
    public Guid? CustomerId { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
    public AppointmentStatus? Status { get; set; }
}

public sealed class DraftLineRequest
{
    public Guid? LineId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid StaffMemberId { get; set; }
    public DateTime StartAt { get; set; }
}

public sealed class CheckAppointmentRequest
{
    public Guid? AppointmentId { get; set; }
    public Guid? CustomerId { get; set; }
    public List<DraftLineRequest> Lines { get; set; } = [];
}

public sealed class LineCheckDto
{
    public int Index { get; init; }
    public DateTime StartAt { get; init; }
    public DateTime EndAt { get; init; }
    public DateTime BlockEndAt { get; init; }
    public IReadOnlyList<IssueDto> Issues { get; init; } = [];
}

public sealed class CheckResultDto
{
    public bool Ok { get; init; }
    public IReadOnlyList<LineCheckDto> Lines { get; init; } = [];
    public IReadOnlyList<IssueDto> Issues { get; init; } = [];
}

public sealed class NewCustomerRequest
{
    public string? Phone { get; set; }
    public string? FullName { get; set; }
}

public sealed class CreateAppointmentRequest
{
    public Guid? CustomerId { get; set; }
    public NewCustomerRequest? NewCustomer { get; set; }
    public AppointmentSource Source { get; set; } = AppointmentSource.DienThoai;
    public string? Note { get; set; }
    public List<DraftLineRequest> Lines { get; set; } = [];
}

public sealed class UpdateAppointmentRequest
{
    public AppointmentSource? Source { get; set; }
    public string? Note { get; set; }
    public List<DraftLineRequest> Lines { get; set; } = [];
}

public sealed class MoveLineRequest
{
    public Guid StaffMemberId { get; set; }
    public DateTime StartAt { get; set; }
}

public sealed class CancelAppointmentRequest
{
    public CancelReason Reason { get; set; }
    public string? Note { get; set; }
}

public sealed class SuggestionQuery
{
    public Guid ServiceId { get; set; }
    public Guid StaffMemberId { get; set; }
    public DateTime StartAt { get; set; }
    public Guid? AppointmentId { get; set; }
}

public sealed record StaffOption(Guid Id, string Code, string FullName, StaffKind Kind, string Color);

public sealed class SuggestionsDto
{
    public IReadOnlyList<StaffOption> FreeTechnicians { get; init; } = [];
    public IReadOnlyList<DateTime> NextSlots { get; init; } = [];
}

public sealed class CustomerPackageBrief
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string PackageName { get; init; } = string.Empty;
    public Guid ServiceId { get; init; }
    public string ServiceName { get; init; } = string.Empty;
    public int TotalSessions { get; init; }
    public int Remaining { get; init; }
    public DateOnly ExpiryDate { get; init; }
    public CustomerPackageStatus Status { get; init; }
    public decimal SessionValue { get; init; }
    public int MinIntervalDays { get; init; }
    public DateTime? LastUsedAt { get; init; }
    public DateTime PurchasedAt { get; init; }
}
