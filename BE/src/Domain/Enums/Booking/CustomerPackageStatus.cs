namespace Domain.Enums.Booking;

/// <summary>Trạng thái gói của khách (02-SRS §5.2).</summary>
public enum CustomerPackageStatus
{
    /// <summary>Đang dùng</summary>
    DangDung = 0,

    /// <summary>Đã dùng hết</summary>
    DaDungHet = 1,

    /// <summary>Hết hạn khi còn buổi</summary>
    HetHan = 2,

    /// <summary>Đã hủy cùng hóa đơn bán gói</summary>
    DaHuy = 3
}
