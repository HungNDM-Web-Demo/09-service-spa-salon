using Domain.Base;
using Domain.Enums.Booking;

namespace Domain.Entities.Booking.Appointments;

/// <summary>Tin nhắn giả lập gửi khách (06 §4 <c>Booking_AppointmentMessages</c>, FR-17): chỉ ghi nhật ký, không gửi thật.</summary>
public class AppointmentMessage : BaseEntity, ICreationTracked, IAuditLogExempt
{
    public const int ContentMaxLength = 500;

    public Guid AppointmentId { get; set; }
    public MessageKind Kind { get; set; }
    public MessageChannel Channel { get; set; } = MessageChannel.Zalo;
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }

    public Guid? CreatedBy { get; set; }
}
