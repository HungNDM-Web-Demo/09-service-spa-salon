using Domain.Base;
using Domain.Enums.Booking;

namespace Domain.Entities.Booking.Invoices;

/// <summary>Dòng hóa đơn (06 §4 <c>Booking_InvoiceLines</c>): một dòng dịch vụ của lịch hẹn hoặc một gói bán.</summary>
public class InvoiceLine : BaseEntity, ICreationTracked, IAuditLogExempt
{
    public const int DescriptionMaxLength = 200;
    public const int NameMaxLength = 100;
    public const int PackageCodeMaxLength = 20;

    public Guid InvoiceId { get; set; }
    public Invoice? Invoice { get; set; }
    public InvoiceLineKind Kind { get; set; }
    public int SortOrder { get; set; }
    public Guid? AppointmentLineId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid? PackageTemplateId { get; set; }
    public Guid? CustomerPackageId { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid StaffMemberId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public int DurationMinutes { get; set; }
    public decimal ListPrice { get; set; }
    public bool UsesPackage { get; set; }
    public decimal Amount { get; set; }
    public decimal BasePrice { get; set; }
    public string? PackageCode { get; set; }
    public int? PackageRemaining { get; set; }
    public DateOnly? PackageExpiryDate { get; set; }

    public Guid? CreatedBy { get; set; }
}
