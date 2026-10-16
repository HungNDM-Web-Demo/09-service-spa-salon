using System.Text.RegularExpressions;
using Application.Common.Exceptions;
using Application.Common.Time;
using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Domain.Entities.Booking.Appointments;
using Domain.Enums.Booking;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Truy vấn, lỗi dùng chung của nghiệp vụ Spa.</summary>
internal static partial class BookingQueries
{
    /// <summary>Dòng của lịch còn phải làm (chờ xác nhận, đã xác nhận, đang phục vụ) bắt đầu từ <paramref name="fromUtc"/>.</summary>
    public static IQueryable<AppointmentLine> PendingWork(IGenericRepository<AppointmentLine> lines, DateTime fromUtc) =>
        lines.QueryNoTracking().Where(l =>
            l.StartAt >= fromUtc
            && (l.Appointment!.Status == AppointmentStatus.ChoXacNhan || l.Appointment.Status == AppointmentStatus.DaXacNhan
                || l.Appointment.Status == AppointmentStatus.DangPhucVu));

    /// <summary>Dòng của lịch còn phải làm trong ngày <paramref name="date"/> (kể cả dòng đã qua giờ của lịch chưa xong).</summary>
    public static IQueryable<AppointmentLine> PendingWorkOn(IGenericRepository<AppointmentLine> lines, DateOnly date) =>
        lines.QueryNoTracking().Where(l =>
            l.Appointment!.Date == date
            && (l.Appointment.Status == AppointmentStatus.ChoXacNhan || l.Appointment.Status == AppointmentStatus.DaXacNhan
                || l.Appointment.Status == AppointmentStatus.DangPhucVu));

    public static async Task<List<AffectedAppointment>> ToAffectedAsync(IQueryable<AppointmentLine> query, CancellationToken ct)
    {
        var rows = await query
            .OrderBy(l => l.StartAt)
            .Select(l => new
            {
                l.AppointmentId,
                l.Appointment!.Code,
                l.Appointment.Date,
                l.StartAt,
                l.EndAt,
                CustomerName = l.Appointment.Customer!.FullName,
                l.ServiceName,
                StaffName = l.StaffMember!.FullName,
                l.Appointment.Status
            })
            .ToListAsync(ct);
        return rows.Select(r => new AffectedAppointment(r.AppointmentId, r.Code, r.Date, r.StartAt, r.EndAt, r.CustomerName, r.ServiceName, r.StaffName, r.Status)).ToList();
    }

    /// <summary>409 <c>LichBiAnhHuong</c> kèm danh sách lịch (BR-27).</summary>
    public static ConflictException Affected(IReadOnlyList<AffectedAppointment> affected) =>
        BookingProblems.Conflict(
            BookingErrorCodes.LichBiAnhHuong,
            $"Có {affected.Count} lịch hẹn bị ảnh hưởng. Chuyển kỹ thuật viên hoặc hủy các lịch này trước.",
            extra: new Dictionary<string, object?> { ["affected"] = affected });

    /// <summary>Mã kế tiếp dạng tiền tố + số, vd DV031, GOI09, NV09.</summary>
    public static string NextCatalogCode(IEnumerable<string> codes, string prefix, int digits)
    {
        var max = codes
            .Select(c => CodeNumber().Match(c))
            .Where(m => m.Success && m.Groups["p"].Value == prefix)
            .Select(m => int.Parse(m.Groups["n"].Value))
            .DefaultIfEmpty(0)
            .Max();
        return prefix + (max + 1).ToString(new string('0', digits));
    }

    /// <summary>Khoảng ngày <c>from</c>–<c>to</c> (yyyy-MM-dd) với mặc định và giới hạn 366 ngày.</summary>
    public static (DateOnly From, DateOnly To) ParseRange(string? from, string? to, DateOnly defaultFrom, DateOnly defaultTo)
    {
        var start = VietnamDates.TryParse(from, out var f) ? f : defaultFrom;
        var end = VietnamDates.TryParse(to, out var t) ? t : defaultTo;
        if (end < start)
            (start, end) = (end, start);
        if (end.DayNumber - start.DayNumber + 1 > Domain.Entities.Booking.BookingRules.MaxReportDays)
            throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure("to", "Khoảng ngày tối đa 366 ngày")]);
        return (start, end);
    }

    [GeneratedRegex(@"^(?<p>[A-Z]+)(?<n>\d+)$")]
    private static partial Regex CodeNumber();
}
