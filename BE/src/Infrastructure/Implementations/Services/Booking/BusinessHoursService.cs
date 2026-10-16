using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.BusinessHours;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Giờ mở, đóng cửa (FR-07). Lịch tương lai rơi ra ngoài giờ mới thì không lưu, liệt kê lịch (06 §4).</summary>
public sealed class BusinessHoursService(
    IGenericRepository<BusinessHours> hours,
    IGenericRepository<AppointmentLine> lines,
    IBookingContext context,
    IUnitOfWork unitOfWork) : IBusinessHoursService
{
    public async Task<BusinessHoursDto> GetAsync(CancellationToken ct = default)
    {
        var (open, close) = await context.GetHoursAsync(ct);
        return new BusinessHoursDto { OpenTime = BookingRules.Hhmm(open), CloseTime = BookingRules.Hhmm(close) };
    }

    public async Task<StoreProfileDto> GetStoreProfileAsync(CancellationToken ct = default)
    {
        var store = await context.GetStoreAsync(ct);
        return new StoreProfileDto(store.Name, store.Address, store.Hotline, store.LogoUrl, store.BankBin, store.BankAccount, store.BankAccountName);
    }

    public async Task<BusinessHoursDto> UpdateAsync(UpdateBusinessHoursRequest request, CancellationToken ct = default)
    {
        BookingRules.TryParseHhmm(request.OpenTime, out var open);
        BookingRules.TryParseHhmm(request.CloseTime, out var close);

        var future = await BookingQueries.PendingWork(lines, context.UtcNow)
            .Select(l => new { l.Id, l.StartAt, l.EndAt })
            .ToListAsync(ct);
        var outside = future
            .Where(l =>
            {
                var start = context.ToLocal(l.StartAt).Minute;
                var end = start + (int)(l.EndAt - l.StartAt).TotalMinutes;
                return start < open || end > close;
            })
            .Select(l => l.Id)
            .ToList();
        if (outside.Count > 0)
            throw BookingQueries.Affected(await BookingQueries.ToAffectedAsync(lines.QueryNoTracking().Where(l => outside.Contains(l.Id)), ct));

        var row = await hours.Query().OrderBy(h => h.CreatedAt).FirstOrDefaultAsync(ct);
        if (row is null)
        {
            row = new BusinessHours();
            await hours.AddAsync(row, ct);
        }

        row.OpenMinute = open;
        row.CloseMinute = close;
        await unitOfWork.SaveChangesAsync(ct);
        return new BusinessHoursDto { OpenTime = BookingRules.Hhmm(open), CloseTime = BookingRules.Hhmm(close) };
    }
}
