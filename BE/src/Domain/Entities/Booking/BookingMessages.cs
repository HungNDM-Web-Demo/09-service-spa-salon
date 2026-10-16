using Domain.Enums.Booking;
using Domain.Enums.Crm;

namespace Domain.Entities.Booking;

/// <summary>Nội dung tin nhắn giả lập (FR-17, 07 §3.10). FE <c>features/booking/lib/messages.ts</c> cùng mẫu câu.</summary>
public static class BookingMessages
{
    /// <summary>"chị Lan Anh", "anh Huy", "quý khách".</summary>
    public static string Salutation(string fullName, Gender? gender)
    {
        var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var shortName = parts.Length >= 2 ? $"{parts[^2]} {parts[^1]}" : fullName;
        if (parts.Length >= 3 && gender == Gender.Nam)
            shortName = parts[^1];
        return gender switch
        {
            Gender.Nu => $"chị {shortName}",
            Gender.Nam => $"anh {shortName}",
            _ => "quý khách"
        };
    }

    public static string Build(
        MessageKind kind,
        string storeName,
        string code,
        DateOnly date,
        int startMinute,
        string services,
        string customerName,
        Gender? gender,
        string? reason = null) => kind switch
    {
        MessageKind.XacNhan =>
            $"{storeName} xác nhận lịch {code} lúc {BookingRules.Hhmm(startMinute)} ngày {BookingRules.FormatDate(date)}: {services}. Hẹn gặp {Salutation(customerName, gender)}!",
        MessageKind.DoiLich =>
            $"Lịch {code} đã đổi sang {BookingRules.Hhmm(startMinute)} ngày {BookingRules.FormatDate(date)}: {services}.",
        MessageKind.Huy =>
            $"Lịch {code} lúc {BookingRules.Hhmm(startMinute)} ngày {BookingRules.FormatDate(date)} đã hủy. Lý do: {reason}.",
        _ =>
            $"Nhắc lịch: {Salutation(customerName, gender)} có hẹn lúc {BookingRules.Hhmm(startMinute)} hôm nay tại {storeName}: {services}."
    };
}
