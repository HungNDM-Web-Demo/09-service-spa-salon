using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Common.Time;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.DaysOff;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Booking;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Tổng quan hôm nay (UC-14; FR-01, FR-02, BR-08, BR-29).</summary>
public sealed class DashboardService(
    IGenericRepository<Appointment> appointments,
    IGenericRepository<Invoice> invoices,
    IGenericRepository<Customer> customers,
    IGenericRepository<DayOff> daysOff,
    IGenericRepository<StaffMember> staff,
    IBookingContext context) : IDashboardService
{
    public async Task<DashboardTodayDto> GetTodayAsync(CancellationToken ct = default)
    {
        var today = context.Today;
        var now = context.UtcNow;
        var dayStart = VietnamDates.StartOfDayUtc(today);
        var dayEnd = VietnamDates.EndOfDayExclusiveUtc(today);
        var closed = await daysOff.QueryNoTracking().Where(d => d.Date == today && d.StaffMemberId == null).Select(d => d.Reason).FirstOrDefaultAsync(ct);

        var todays = await appointments.QueryNoTracking().Include(a => a.Lines).Include(a => a.Customer)
            .Where(a => a.Date == today).ToListAsync(ct);
        var revenue = await invoices.QueryNoTracking()
            .Where(i => i.Status == InvoiceStatus.DaThanhToan && i.PaidAt >= dayStart && i.PaidAt < dayEnd)
            .Select(i => i.Total).ToListAsync(ct);
        var newCustomers = await customers.QueryNoTracking().CountAsync(c => c.CreatedAt >= dayStart && c.CreatedAt < dayEnd, ct);
        var pending = await appointments.QueryNoTracking().Include(a => a.Lines).Include(a => a.Customer)
            .Where(a => a.Status == AppointmentStatus.ChoXacNhan && a.Date >= today)
            .OrderBy(a => a.CreatedAt).ToListAsync(ct);
        var names = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        var limit = now.AddHours(2);

        List<DashboardCardDto> tomorrow = [];
        if (closed is not null)
        {
            var next = today.AddDays(1);
            var list = await appointments.QueryNoTracking().Include(a => a.Lines).Include(a => a.Customer)
                .Where(a => a.Date == next && (a.Status == AppointmentStatus.ChoXacNhan || a.Status == AppointmentStatus.DaXacNhan))
                .OrderBy(a => a.StartAt).ToListAsync(ct);
            tomorrow = list.Select(a => Card(a, names, now)).ToList();
        }

        return new DashboardTodayDto
        {
            Date = today,
            ShopClosedReason = closed,
            Counts = new DashboardCountsDto
            {
                Total = todays.Count(a => a.Status != AppointmentStatus.DaHuy),
                Pending = todays.Count(a => a.Status == AppointmentStatus.ChoXacNhan),
                Confirmed = todays.Count(a => a.Status == AppointmentStatus.DaXacNhan),
                InService = todays.Count(a => a.Status == AppointmentStatus.DangPhucVu),
                Completed = todays.Count(a => a.Status == AppointmentStatus.HoanThanh),
                NoShow = todays.Count(a => a.Status == AppointmentStatus.KhongDen),
                Cancelled = todays.Count(a => a.Status == AppointmentStatus.DaHuy)
            },
            RevenueToday = revenue.Sum(),
            NewCustomersToday = newCustomers,
            Upcoming = todays
                .Where(a => a.Status is AppointmentStatus.ChoXacNhan or AppointmentStatus.DaXacNhan && a.StartAt >= now.AddMinutes(-BookingRules.LateMinutes) && a.StartAt <= limit)
                .OrderBy(a => a.StartAt)
                .Select(a => Card(a, names, now))
                .ToList(),
            PendingOnline = pending.Select(a => Card(a, names, now)).ToList(),
            Tomorrow = tomorrow
        };
    }

    internal static DashboardCardDto Card(Appointment a, IReadOnlyDictionary<Guid, string> names, DateTime now) => new()
    {
        Id = a.Id,
        Code = a.Code,
        Status = a.Status,
        Source = a.Source,
        CustomerName = a.Customer?.FullName ?? string.Empty,
        StartAt = a.StartAt,
        EndAt = a.EndAt,
        Services = string.Join(", ", a.Lines.OrderBy(l => l.SortOrder).Select(l => l.ServiceName)),
        StaffNames = string.Join(", ", a.Lines.OrderBy(l => l.SortOrder).Select(l => names.GetValueOrDefault(l.StaffMemberId, string.Empty)).Distinct()),
        CreatedAt = a.CreatedAt,
        PendingOverdue = a.Status == AppointmentStatus.ChoXacNhan && now - a.CreatedAt > TimeSpan.FromMinutes(BookingRules.PendingOverdueMinutes),
        IsLate = a.Status is AppointmentStatus.ChoXacNhan or AppointmentStatus.DaXacNhan
                 && VietnamDates.DateOf(a.StartAt) == VietnamDates.DateOf(now)
                 && now >= a.StartAt.AddMinutes(BookingRules.LateMinutes)
    };
}
