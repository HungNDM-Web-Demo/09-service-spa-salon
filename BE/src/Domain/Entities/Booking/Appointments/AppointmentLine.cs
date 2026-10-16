using Domain.Base;
using Domain.Entities.Hr.StaffMembers;

namespace Domain.Entities.Booking.Appointments;

/// <summary>
/// Dòng dịch vụ của lịch hẹn (06 §4 <c>Booking_AppointmentLines</c>). Tên, giá, thời lượng, thời gian dọn chụp lúc tạo (BR-14).
/// Khoảng chiếm chỗ: [<see cref="StartAt"/>, <see cref="EndAt"/> + <see cref="CleanupMinutes"/>).
/// </summary>
public class AppointmentLine : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int ServiceNameMaxLength = 150;

    public Guid AppointmentId { get; set; }
    public Appointment? Appointment { get; set; }
    public Guid ServiceId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int DurationMinutes { get; set; }
    public int CleanupMinutes { get; set; }
    public Guid StaffMemberId { get; set; }
    public StaffMember? StaffMember { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public int SortOrder { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public DateTime BlockEndAt => EndAt.AddMinutes(CleanupMinutes);
}
