using Domain.Base;
using Domain.Entities.Crm.Customers;
using Domain.Enums.Booking;

namespace Domain.Entities.Booking.Appointments;

/// <summary>
/// Lịch hẹn (06 §4 <c>Booking_Appointments</c>): một lần khách tới tiệm, gồm 1–5 dòng dịch vụ.
/// <see cref="StartAt"/>, <see cref="EndAt"/>, <see cref="Date"/> luôn đồng bộ với các dòng qua <see cref="RefreshSpan"/>.
/// </summary>
public class Appointment : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int NoteMaxLength = 500;
    public const int NameMaxLength = 100;
    public const int CancelNoteMaxLength = 200;

    public string Code { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public DateOnly Date { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public AppointmentSource Source { get; set; }
    public AppointmentStatus Status { get; set; }
    public string? Note { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public string? ConfirmedByName { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public string? CheckedInByName { get; set; }
    public CancelReason? CancelReason { get; set; }
    public string? CancelNote { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelledByName { get; set; }
    public DateTime? NoShowAt { get; set; }
    public string? NoShowByName { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? ReminderSentAt { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<AppointmentLine> Lines { get; set; } = [];
    public List<AppointmentMessage> Messages { get; set; } = [];

    /// <summary>Lịch chiếm chỗ KTV và tính trùng giờ của khách (BR-03, BR-05).</summary>
    public bool IsOccupying => BookingRules.IsOccupying(Status);

    /// <summary>Cập nhật giờ bắt đầu sớm nhất, kết thúc muộn nhất, ngày (giờ Việt Nam) và thứ tự dòng theo các dòng.</summary>
    public void RefreshSpan(Func<DateTime, DateOnly> dateOf)
    {
        if (Lines.Count == 0)
            return;
        StartAt = Lines.Min(l => l.StartAt);
        EndAt = Lines.Max(l => l.EndAt);
        Date = dateOf(StartAt);
        var order = 1;
        foreach (var line in Lines.OrderBy(l => l.StartAt).ThenBy(l => l.SortOrder).ToList())
            line.SortOrder = order++;
    }

    public void SetCreatedAt(DateTime value) => CreatedAt = value;
}
