namespace Domain.Enums.Hr;

/// <summary>Ca làm trong ngày (BR-04).</summary>
public enum ShiftType
{
    /// <summary>Ca sáng: giờ mở cửa – 15:00</summary>
    Sang = 0,

    /// <summary>Ca chiều: 15:00 – giờ đóng cửa</summary>
    Chieu = 1,

    /// <summary>Cả ngày</summary>
    CaNgay = 2,

    /// <summary>Nghỉ</summary>
    Nghi = 3
}
