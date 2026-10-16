using Domain.Base;
using Domain.Entities.Crm.Customers;
using Domain.Enums.Booking;

namespace Domain.Entities.Booking.CustomerPackages;

/// <summary>
/// Gói khách đã mua (06 §4 <c>Booking_CustomerPackages</c>). Số buổi, giá, giá trị một buổi, khoảng cách tối thiểu,
/// tỉ lệ hoa hồng chụp lúc mua; đổi gói mẫu sau đó không ảnh hưởng (BR-27).
/// </summary>
public class CustomerPackage : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 150;
    public const int ReasonMaxLength = 200;
    public const int PersonMaxLength = 100;

    public string Code { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public Guid PackageTemplateId { get; set; }
    public string PackageName { get; set; } = string.Empty;
    public Guid ServiceId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public int TotalSessions { get; set; }
    public int UsedSessions { get; set; }
    public decimal Price { get; set; }
    public decimal SessionValue { get; set; }
    public int MinIntervalDays { get; set; }
    public decimal CommissionRate { get; set; }
    public DateTime PurchasedAt { get; set; }
    public DateOnly ExpiryDate { get; set; }
    public int? ExtendedDays { get; set; }
    public string? ExtendReason { get; set; }
    public DateTime? ExtendedAt { get; set; }
    public string? ExtendedByName { get; set; }
    public Guid ConsultantStaffId { get; set; }
    public string ConsultantName { get; set; } = string.Empty;
    public Guid InvoiceId { get; set; }
    public CustomerPackageStatus Status { get; set; } = CustomerPackageStatus.DangDung;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<PackageUsage> Usages { get; set; } = [];

    public int Remaining => TotalSessions - UsedSessions;

    public void SetCreatedAt(DateTime value) => CreatedAt = value;
}
