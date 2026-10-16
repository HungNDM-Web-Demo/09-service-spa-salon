using Domain.Base;
using Domain.Entities.Booking.Services;

namespace Domain.Entities.Booking.PackageTemplates;

/// <summary>Gói liệu trình mẫu (06 §4 <c>Booking_PackageTemplates</c>, FR-04). Mỗi gói áp cho đúng một dịch vụ.</summary>
public class PackageTemplate : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 150;

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Guid ServiceId { get; set; }
    public Service? Service { get; set; }
    public int Sessions { get; set; }
    public decimal Price { get; set; }
    public int ValidityMonths { get; set; }
    public int MinIntervalDays { get; set; }
    public decimal CommissionRate { get; set; } = BookingRules.DefaultPackageCommissionRate;
    public bool IsActive { get; set; } = true;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
