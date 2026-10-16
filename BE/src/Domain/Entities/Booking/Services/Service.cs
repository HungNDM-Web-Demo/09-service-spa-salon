using Domain.Base;
using Domain.Enums.Booking;

namespace Domain.Entities.Booking.Services;

/// <summary>Dịch vụ, bảng giá, mức hoa hồng (06 §4 <c>Booking_Services</c>, FR-03).</summary>
public class Service : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 150;
    public const int DescriptionMaxLength = 1000;
    public const int ImageUrlMaxLength = 500;

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Guid GroupId { get; set; }
    public ServiceGroup? Group { get; set; }
    public int DurationMinutes { get; set; }
    public int CleanupMinutes { get; set; }
    public decimal Price { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool AllowOnline { get; set; }
    public CommissionType CommissionType { get; set; }
    public decimal CommissionValue { get; set; }
    public bool IsVisible { get; set; } = true;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
