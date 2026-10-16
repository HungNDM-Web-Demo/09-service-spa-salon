using Application.Common.Exceptions;
using Application.Common.Time;
using Application.DTOs.Hr;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Interfaces.Services.Hr;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Hr.DaysOff;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Booking;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Hr;

/// <summary>Lịch trong ngày của KTV đang đăng nhập (UC-12, FR-33): không có số điện thoại khách (NFR-06).</summary>
public sealed class MyScheduleService(
    IGenericRepository<StaffMember> staff,
    IGenericRepository<AppointmentLine> lines,
    IGenericRepository<DayOff> daysOff,
    IBookingContext context) : IMyScheduleService
{
    public async Task<MyScheduleDto> GetAsync(string? date, CancellationToken ct = default)
    {
        var day = VietnamDates.TryParse(date, out var d) ? d : context.Today;
        var actor = await context.GetActorAsync(ct);
        var member = await staff.QueryNoTracking().Include(s => s.Shifts).FirstOrDefaultAsync(s => s.UserId == actor.UserId, ct)
                     ?? throw new NotFoundException("Tài khoản chưa liên kết với kỹ thuật viên nào.");
        var (open, close) = await context.GetHoursAsync(ct);
        var shift = member.ShiftOn(BookingRules.IsoDayOfWeek(day));
        var window = BookingRules.ShiftWindow(shift, open, close);
        var off = await daysOff.QueryNoTracking()
            .Where(x => x.Date == day && (x.StaffMemberId == member.Id || x.StaffMemberId == null))
            .Select(x => x.Reason)
            .FirstOrDefaultAsync(ct);

        var items = await lines.QueryNoTracking()
            .Where(l => l.StaffMemberId == member.Id && l.Appointment!.Date == day
                        && (l.Appointment.Status == AppointmentStatus.ChoXacNhan || l.Appointment.Status == AppointmentStatus.DaXacNhan
                            || l.Appointment.Status == AppointmentStatus.DangPhucVu || l.Appointment.Status == AppointmentStatus.HoanThanh))
            .OrderBy(l => l.StartAt)
            .Select(l => new MyScheduleItemDto
            {
                AppointmentId = l.AppointmentId,
                AppointmentCode = l.Appointment!.Code,
                Status = l.Appointment.Status,
                LineId = l.Id,
                StartAt = l.StartAt,
                EndAt = l.EndAt,
                ServiceName = l.ServiceName,
                CustomerName = l.Appointment.Customer!.FullName,
                CustomerNote = l.Appointment.Customer.Note,
                AppointmentNote = l.Appointment.Note
            })
            .ToListAsync(ct);

        return new MyScheduleDto
        {
            StaffMemberId = member.Id,
            StaffName = member.FullName,
            Date = day,
            Shift = shift,
            ShiftStart = window?.Start,
            ShiftEnd = window?.End,
            OffReason = off ?? (window is null ? $"Nghỉ {BookingRules.DayOfWeekLabel(BookingRules.IsoDayOfWeek(day))}" : null),
            Items = items
        };
    }
}
