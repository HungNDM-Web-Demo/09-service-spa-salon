namespace Domain.Enums.Booking;

/// <summary>Trạng thái lịch hẹn (02-SRS §5.2).</summary>
public enum AppointmentStatus
{
    /// <summary>Chờ xác nhận: khách đặt online, đã giữ chỗ</summary>
    ChoXacNhan = 0,

    /// <summary>Đã xác nhận</summary>
    DaXacNhan = 1,

    /// <summary>Đang phục vụ: đã check-in</summary>
    DangPhucVu = 2,

    /// <summary>Hoàn thành: đã thanh toán</summary>
    HoanThanh = 3,

    /// <summary>Đã hủy</summary>
    DaHuy = 4,

    /// <summary>Không đến</summary>
    KhongDen = 5
}
