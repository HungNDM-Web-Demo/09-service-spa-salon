namespace Domain.Enums.Booking;

/// <summary>Nguồn đặt lịch.</summary>
public enum AppointmentSource
{
    /// <summary>Khách tự đặt trên trang đặt lịch</summary>
    Online = 0,

    /// <summary>Gọi điện</summary>
    DienThoai = 1,

    /// <summary>Khách vãng lai</summary>
    VangLai = 2,

    /// <summary>Nhắn Zalo, Facebook</summary>
    ZaloFacebook = 3
}
