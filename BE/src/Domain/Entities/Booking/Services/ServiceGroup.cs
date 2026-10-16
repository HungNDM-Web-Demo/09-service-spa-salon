using Domain.Base;

namespace Domain.Entities.Booking.Services;

/// <summary>Nhóm dịch vụ (06 §4 <c>Booking_ServiceGroups</c>).</summary>
public class ServiceGroup : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int NameMaxLength = 100;

    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsVisible { get; set; } = true;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
