namespace Domain.Enums.Booking;

/// <summary>Phương thức thanh toán (FR-25).</summary>
public enum PaymentMethod
{
    /// <summary>Tiền mặt</summary>
    TienMat = 0,

    /// <summary>Chuyển khoản QR giả lập</summary>
    ChuyenKhoan = 1,

    /// <summary>Thẻ, ghi mã chuẩn chi</summary>
    The = 2,

    /// <summary>Không thu tiền: hóa đơn 0 ₫ (BR-15)</summary>
    KhongThu = 3
}
