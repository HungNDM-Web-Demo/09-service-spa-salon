namespace Domain.Enums.Booking;

/// <summary>Loại tin nhắn giả lập (FR-17).</summary>
public enum MessageKind
{
    /// <summary>Tin xác nhận</summary>
    XacNhan = 0,

    /// <summary>Tin đổi lịch</summary>
    DoiLich = 1,

    /// <summary>Tin hủy</summary>
    Huy = 2,

    /// <summary>Tin nhắc trước 2 giờ</summary>
    Nhac = 3
}
