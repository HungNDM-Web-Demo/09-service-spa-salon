using System.Globalization;
using Domain.Enums.Booking;
using Domain.Enums.Hr;

namespace Domain.Entities.Booking;

/// <summary>
/// Hằng số và phép tính thuần của nghiệp vụ Spa (06 §3, 07 §3). FE <c>features/booking/lib/rules.ts</c> cùng giá trị,
/// cùng câu báo. Giờ trong ngày tính bằng phút từ 00:00 giờ Việt Nam.
/// </summary>
public static class BookingRules
{
    public const int SlotStepMinutes = 15;
    public const int OnlineStepMinutes = 30;
    public const int OnlineMinLeadMinutes = 120;
    public const int OnlineMaxDaysAhead = 30;
    public const int OnlineMaxServices = 3;
    public const int OnlineMaxPendingPerPhone = 2;
    public const int MaxLines = 5;
    public const int PendingOverdueMinutes = 30;
    public const int LateMinutes = 15;
    public const int SelfCancelMinLeadMinutes = 120;
    public const int ReminderLeadMinutes = 120;
    public const int NoShowFlagThreshold = 3;
    public const int NoShowWindowDays = 90;
    public const int StaffDiscountLimitPercent = 10;
    public const int ManagerDiscountLimitPercent = 50;
    public const int MaxExtendDays = 60;
    public const int ShiftSplitMinute = 900;
    public const int DefaultOpenMinute = 540;
    public const int DefaultCloseMinute = 1260;
    public const int LatestCloseMinute = 1380;
    public const int MinOpenHours = 4;
    public const decimal DefaultPackageCommissionRate = 5;
    public const decimal MaxCommissionPercent = 50;
    public const int MaxReportDays = 366;
    public const int ExpiringSoonDays = 30;
    public const int DurationMin = 15;
    public const int DurationMax = 240;
    public const int CleanupMax = 30;
    public const int CleanupDefault = 10;
    public const int SessionsMin = 2;
    public const int SessionsMax = 50;
    public const int ValidityMonthsMax = 36;
    public const int MinIntervalDaysMax = 90;

    public const string AppointmentPrefix = "LH";
    public const string InvoicePrefix = "HD";
    public const string PackagePrefix = "GL";
    public const string CommissionPrefix = "HH";
    public const string OnlineCreatorName = "Khách đặt online";
    public const string SystemActorName = "Hệ thống";

    private static readonly CultureInfo Vi = CultureInfo.GetCultureInfo("vi-VN");

    /// <summary>Lịch chiếm chỗ KTV, tính trùng giờ của khách (BR-03, BR-05).</summary>
    public static bool IsOccupying(AppointmentStatus status) =>
        status is AppointmentStatus.ChoXacNhan or AppointmentStatus.DaXacNhan or AppointmentStatus.DangPhucVu
            or AppointmentStatus.HoanThanh;

    public static int Floor15(int minutes) => minutes - Mod(minutes, SlotStepMinutes);

    public static int Ceil15(int minutes) => Mod(minutes, SlotStepMinutes) == 0 ? minutes : Floor15(minutes) + SlotStepMinutes;

    /// <summary>Làm tròn xuống tới bội số 1.000 ₫ (06 §3).</summary>
    public static decimal Floor1000(decimal value) => Math.Floor(value / 1000m) * 1000m;

    /// <summary>Hai khoảng [a1, b1), [a2, b2) giao nhau; chạm mép không tính (BR-03).</summary>
    public static bool Overlaps(int a1, int b1, int a2, int b2) => a1 < b2 && a2 < b1;

    /// <summary>Khung giờ của ca (BR-04); <see cref="ShiftType.Nghi"/> trả null.</summary>
    public static (int Start, int End)? ShiftWindow(ShiftType shift, int open, int close) => shift switch
    {
        ShiftType.Sang => (open, Math.Min(ShiftSplitMinute, close)),
        ShiftType.Chieu => (Math.Max(ShiftSplitMinute, open), close),
        ShiftType.CaNgay => (open, close),
        _ => null
    };

    /// <summary>"ca sáng 09:00–15:00", "ca chiều 15:00–21:00", "cả ngày 09:00–21:00".</summary>
    public static string ShiftLabel(ShiftType shift, int open, int close)
    {
        var window = ShiftWindow(shift, open, close);
        if (window is null)
            return "nghỉ";
        var name = shift switch
        {
            ShiftType.Sang => "ca sáng",
            ShiftType.Chieu => "ca chiều",
            _ => "cả ngày"
        };
        return $"{name} {Hhmm(window.Value.Start)}–{Hhmm(window.Value.End)}";
    }

    public static string Hhmm(int minutes)
    {
        var m = Mod(minutes, 1440);
        return $"{m / 60:00}:{m % 60:00}";
    }

    public static bool TryParseHhmm(string? value, out int minutes)
    {
        minutes = 0;
        if (string.IsNullOrWhiteSpace(value) || !TimeOnly.TryParseExact(value.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time))
            return false;
        minutes = time.Hour * 60 + time.Minute;
        return true;
    }

    /// <summary>1 = Thứ Hai … 7 = Chủ nhật.</summary>
    public static int IsoDayOfWeek(DateOnly date) => date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;

    public static string DayOfWeekLabel(int isoDayOfWeek) => isoDayOfWeek switch
    {
        1 => "Thứ Hai",
        2 => "Thứ Ba",
        3 => "Thứ Tư",
        4 => "Thứ Năm",
        5 => "Thứ Sáu",
        6 => "Thứ Bảy",
        _ => "Chủ nhật"
    };

    public static string FormatDate(DateOnly date) => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    /// <summary>"1.250.000 ₫".</summary>
    public static string FormatVnd(decimal value) => string.Format(Vi, "{0:N0} ₫", value);

    /// <summary>Giá trị một buổi = giá gói ÷ số buổi, làm tròn xuống 1.000 ₫ (BR-22).</summary>
    public static decimal SessionValue(decimal price, int sessions) => sessions <= 0 ? 0 : Floor1000(price / sessions);

    /// <summary>Hạn dùng = ngày mua + số tháng; tháng đích không có ngày đó thì lấy ngày cuối tháng (BR-20).</summary>
    public static DateOnly ExpiryDate(DateOnly purchaseDate, int months) => purchaseDate.AddMonths(months);

    /// <summary>Mã chứng từ: tiền tố + yyMMdd + 3 số (BR-30).</summary>
    public static string DocCode(string prefix, DateOnly date, int sequence) =>
        $"{prefix}{date.ToString("yyMMdd", CultureInfo.InvariantCulture)}{sequence:000}";

    public static string DocStem(string prefix, DateOnly date) => $"{prefix}{date.ToString("yyMMdd", CultureInfo.InvariantCulture)}";

    /// <summary>Tháng dạng <c>yyyyMM</c>.</summary>
    public static int MonthKey(DateOnly date) => date.Year * 100 + date.Month;

    public static DateOnly MonthStart(int monthKey) => new(monthKey / 100, monthKey % 100, 1);

    /// <summary>"2026-10" ↔ 202610.</summary>
    public static string MonthText(int monthKey) => $"{monthKey / 100:0000}-{monthKey % 100:00}";

    public static bool TryParseMonth(string? value, out int monthKey)
    {
        monthKey = 0;
        if (string.IsNullOrWhiteSpace(value) || !DateOnly.TryParseExact(value.Trim() + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return false;
        monthKey = MonthKey(d);
        return true;
    }

    public static string CommissionPeriodCode(int monthKey) => $"{CommissionPrefix}{monthKey % 10000:0000}";

    /// <summary>"MM/yyyy".</summary>
    public static string MonthLabel(int monthKey) => $"{monthKey % 100:00}/{monthKey / 100:0000}";

    /// <summary>Che số điện thoại cho trang công khai: "0903 *** 456" (NFR-05).</summary>
    public static string MaskPhone(string phone) =>
        phone.Length < 7 ? phone : $"{phone[..4]} *** {phone[^3..]}";

    public static string CancelReasonLabel(CancelReason reason) => reason switch
    {
        CancelReason.KhachBaoHuy => "Khách báo hủy",
        CancelReason.TiemDoiLich => "Tiệm đổi lịch",
        CancelReason.HetCho => "Hết chỗ",
        CancelReason.KhongLienLacDuoc => "Không liên lạc được",
        CancelReason.KhachTuHuy => "Khách tự hủy online",
        _ => "Khác"
    };

    private static int Mod(int value, int divisor) => ((value % divisor) + divisor) % divisor;
}
