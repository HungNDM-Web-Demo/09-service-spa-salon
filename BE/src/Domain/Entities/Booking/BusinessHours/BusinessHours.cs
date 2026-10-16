using Domain.Base;

namespace Domain.Entities.Booking.BusinessHours;

/// <summary>Giờ mở, đóng cửa của tiệm (06 §4 <c>Booking_BusinessHours</c>, một dòng duy nhất, FR-07). Đơn vị: phút từ 00:00.</summary>
public class BusinessHours : BaseEntity, ICreationTracked, IModificationTracked
{
    public int OpenMinute { get; set; } = BookingRules.DefaultOpenMinute;
    public int CloseMinute { get; set; } = BookingRules.DefaultCloseMinute;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
