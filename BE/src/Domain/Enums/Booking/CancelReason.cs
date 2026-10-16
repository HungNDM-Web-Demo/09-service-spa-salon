namespace Domain.Enums.Booking;

/// <summary>Lý do hủy, từ chối lịch hẹn (FR-12, FR-14, FR-21).</summary>
public enum CancelReason
{
    /// <summary>Khách báo hủy</summary>
    KhachBaoHuy = 0,

    /// <summary>Tiệm đổi lịch</summary>
    TiemDoiLich = 1,

    /// <summary>Hết chỗ (từ chối lịch online)</summary>
    HetCho = 2,

    /// <summary>Không liên lạc được (từ chối lịch online)</summary>
    KhongLienLacDuoc = 3,

    /// <summary>Khách tự hủy trên trang tra cứu</summary>
    KhachTuHuy = 4,

    /// <summary>Khác, bắt buộc ghi chú</summary>
    Khac = 5
}
