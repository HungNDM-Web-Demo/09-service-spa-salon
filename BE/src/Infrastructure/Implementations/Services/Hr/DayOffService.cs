using Application.Common.Exceptions;
using Application.Common.Time;
using Application.DTOs.Hr;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Interfaces.Services.Hr;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Hr.DaysOff;
using Domain.Entities.Hr.StaffMembers;
using Infrastructure.Implementations.Services.Booking;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Hr;

/// <summary>Ngày nghỉ đột xuất của KTV, ngày tiệm nghỉ (UC-02 1a, 1b; BR-27, TC-04).</summary>
public sealed class DayOffService(
    IGenericRepository<DayOff> daysOff,
    IGenericRepository<StaffMember> staff,
    IGenericRepository<AppointmentLine> lines,
    IBookingContext context,
    IUnitOfWork unitOfWork) : IDayOffService
{
    public async Task<IReadOnlyList<DayOffDto>> GetAsync(DayOffQuery query, CancellationToken ct = default)
    {
        var from = VietnamDates.TryParse(query.From, out var f) ? f : context.Today.AddDays(-30);
        var to = VietnamDates.TryParse(query.To, out var t) ? t : context.Today.AddDays(90);
        var list = await daysOff.QueryNoTracking().Where(d => d.Date >= from && d.Date <= to).OrderBy(d => d.Date).ToListAsync(ct);
        var names = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        return list.Select(d => ToDto(d, d.StaffMemberId is { } sid ? names.GetValueOrDefault(sid) : null)).ToList();
    }

    public async Task<DayOffDto> CreateAsync(CreateDayOffRequest request, CancellationToken ct = default)
    {
        var date = request.Date!.Value;
        if (date < context.Today)
            throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure("date", "Không đăng ký ngày nghỉ đã qua")]);

        string? staffName = null;
        if (request.StaffMemberId is { } sid)
        {
            staffName = await staff.QueryNoTracking().Where(s => s.Id == sid).Select(s => s.FullName).FirstOrDefaultAsync(ct)
                        ?? throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure("staffMemberId", "Chọn kỹ thuật viên")]);
        }

        if (await daysOff.AnyAsync(d => d.Date == date && d.StaffMemberId == request.StaffMemberId, ct))
            throw new ConflictException(request.StaffMemberId is null ? "Ngày này đã là ngày tiệm nghỉ." : $"{staffName} đã có ngày nghỉ này.", "date");

        var work = BookingQueries.PendingWorkOn(lines, date);
        if (request.StaffMemberId is { } staffId)
            work = work.Where(l => l.StaffMemberId == staffId);
        var affected = await BookingQueries.ToAffectedAsync(work, ct);
        if (affected.Count > 0)
            throw BookingQueries.Affected(affected);

        var dayOff = new DayOff { StaffMemberId = request.StaffMemberId, Date = date, Reason = request.Reason!.Trim() };
        await daysOff.AddAsync(dayOff, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(dayOff, staffName);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var dayOff = await daysOff.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy ngày nghỉ.");
        daysOff.Delete(dayOff);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private static DayOffDto ToDto(DayOff d, string? staffName) => new()
    {
        Id = d.Id,
        StaffMemberId = d.StaffMemberId,
        StaffName = staffName,
        Date = d.Date,
        Reason = d.Reason
    };
}
