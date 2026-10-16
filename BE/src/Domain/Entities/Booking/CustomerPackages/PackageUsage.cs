using Domain.Base;

namespace Domain.Entities.Booking.CustomerPackages;

/// <summary>Một lần trừ buổi (06 §4 <c>Booking_PackageUsages</c>). Hủy hóa đơn thì <see cref="Refunded"/> = true (BR-26).</summary>
public class PackageUsage : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 100;
    public const int ReasonMaxLength = 200;

    public Guid CustomerPackageId { get; set; }
    public CustomerPackage? CustomerPackage { get; set; }
    public Guid InvoiceId { get; set; }
    public Guid InvoiceLineId { get; set; }
    public Guid? AppointmentId { get; set; }
    public string? AppointmentCode { get; set; }
    public DateTime UsedAt { get; set; }
    public Guid StaffMemberId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public string? OverrideReason { get; set; }
    public bool Refunded { get; set; }
    public DateTime? RefundedAt { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
