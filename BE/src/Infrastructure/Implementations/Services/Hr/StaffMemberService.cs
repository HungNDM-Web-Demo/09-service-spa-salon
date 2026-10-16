using Application.Common.Exceptions;
using Application.DTOs.Booking;
using Application.DTOs.Hr;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Interfaces.Services.Hr;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Hr.Commissions;
using Domain.Entities.Hr.StaffMembers;
using Domain.Entities.System.Users;
using Domain.Enums.Hr;
using Infrastructure.Implementations.Services.Booking;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Hr;

/// <summary>Nhân viên, dịch vụ làm được, ca tuần, nghỉ việc (UC-02; FR-05, FR-06, BR-27).</summary>
public sealed class StaffMemberService(
    IGenericRepository<StaffMember> staff,
    IGenericRepository<User> users,
    IGenericRepository<AppointmentLine> lines,
    IGenericRepository<Commission> commissions,
    IGenericRepository<CustomerPackage> packages,
    IBookingContext context,
    IUnitOfWork unitOfWork) : IStaffMemberService
{
    public async Task<IReadOnlyList<StaffMemberDto>> GetAllAsync(CancellationToken ct = default)
    {
        var list = await staff.QueryNoTracking().Include(s => s.Services).Include(s => s.Shifts).ToListAsync(ct);
        var userIds = list.Where(s => s.UserId != null).Select(s => s.UserId!.Value).ToList();
        var usernames = await users.QueryNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Username, ct);
        return list
            .OrderBy(s => s.Kind).ThenBy(s => s.SortOrder).ThenBy(s => s.Code, StringComparer.Ordinal)
            .Select(s => ToDto(s, s.UserId is { } uid ? usernames.GetValueOrDefault(uid) : null))
            .ToList();
    }

    public async Task<IReadOnlyList<StaffOption>> GetOptionsAsync(CancellationToken ct = default)
    {
        var list = await staff.QueryNoTracking().Where(s => s.IsActive).ToListAsync(ct);
        return list
            .OrderBy(s => s.Kind).ThenBy(s => s.SortOrder).ThenBy(s => s.Code, StringComparer.Ordinal)
            .Select(s => new StaffOption(s.Id, s.Code, s.FullName, s.Kind, s.Color))
            .ToList();
    }

    public async Task<IReadOnlyList<AccountCandidate>> GetAccountCandidatesAsync(CancellationToken ct = default)
    {
        var accounts = await users.QueryNoTracking()
            .Where(u => u.IsActive)
            .Select(u => new { u.Id, u.Username, u.FullName, Roles = u.UserRoles.Select(r => r.Role.Code).ToList() })
            .ToListAsync(ct);
        var linked = await staff.QueryNoTracking().Where(s => s.UserId != null).Select(s => new { s.UserId, s.Id, s.FullName }).ToListAsync(ct);
        return accounts
            .OrderBy(a => a.Username, StringComparer.Ordinal)
            .Select(a =>
            {
                var link = linked.FirstOrDefault(l => l.UserId == a.Id);
                return new AccountCandidate(a.Id, a.Username, a.FullName, a.Roles, link?.Id, link?.FullName);
            })
            .ToList();
    }

    public async Task<NextCodeDto> NextCodeAsync(CancellationToken ct = default) =>
        new(BookingQueries.NextCatalogCode(await staff.QueryNoTracking().Select(s => s.Code).ToListAsync(ct), "NV", 2));

    public async Task<StaffMemberDto> CreateAsync(SaveStaffMemberRequest request, CancellationToken ct = default)
    {
        var code = request.Code!.Trim();
        if (await staff.AnyAsync(s => s.Code == code, ct))
            throw new ConflictException($"Mã nhân viên {code} đã tồn tại.", "code");
        await EnsureAccountAsync(request.UserId, null, ct);

        var member = new StaffMember { Code = code };
        Apply(member, request);
        member.SortOrder = (await staff.QueryNoTracking().Select(s => (int?)s.SortOrder).MaxAsync(ct) ?? 0) + 10;
        if (member.IsTechnician)
        {
            member.Services = request.ServiceIds.Distinct().Select(id => new StaffService { StaffMemberId = member.Id, ServiceId = id }).ToList();
            var shifts = request.Shifts is { Count: 7 } s ? s : Enumerable.Repeat(ShiftType.CaNgay, 7).ToList();
            member.Shifts = shifts.Select((shift, i) => new WeeklyShift { StaffMemberId = member.Id, DayOfWeek = i + 1, Shift = shift }).ToList();
        }

        await staff.AddAsync(member, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(member.Id, ct);
    }

    public async Task<StaffMemberDto> UpdateAsync(Guid id, SaveStaffMemberRequest request, CancellationToken ct = default)
    {
        var member = await staff.Query().Include(s => s.Services).Include(s => s.Shifts).FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw new NotFoundException("Không tìm thấy nhân viên.");
        var code = request.Code!.Trim();
        if (await staff.AnyAsync(s => s.Code == code && s.Id != id, ct))
            throw new ConflictException($"Mã nhân viên {code} đã tồn tại.", "code");
        await EnsureAccountAsync(request.UserId, id, ct);

        var newServices = request.Kind == StaffKind.KyThuatVien ? request.ServiceIds.Distinct().ToHashSet() : [];
        var removed = member.Services.Select(s => s.ServiceId).Where(sid => !newServices.Contains(sid)).ToList();
        if (removed.Count > 0)
        {
            // BR-27: bỏ dịch vụ làm được mà còn lịch dùng dịch vụ đó.
            var affected = await BookingQueries.ToAffectedAsync(
                BookingQueries.PendingWork(lines, context.UtcNow).Where(l => l.StaffMemberId == id && removed.Contains(l.ServiceId)), ct);
            if (affected.Count > 0)
                throw BookingQueries.Affected(affected);
        }

        if (request.Shifts is { Count: 7 } shifts && member.IsTechnician)
            await EnsureShiftsFitAsync(member, shifts, ct);

        member.Code = code;
        Apply(member, request);
        member.Services.RemoveAll(s => !newServices.Contains(s.ServiceId));
        foreach (var sid in newServices.Where(sid => member.Services.All(s => s.ServiceId != sid)))
            member.Services.Add(new StaffService { StaffMemberId = id, ServiceId = sid });

        if (member.IsTechnician)
        {
            var target = request.Shifts is { Count: 7 } s2
                ? s2
                : member.Shifts.Count == 7 ? member.Shifts.OrderBy(x => x.DayOfWeek).Select(x => x.Shift).ToList() : Enumerable.Repeat(ShiftType.CaNgay, 7).ToList();
            SetShifts(member, target);
        }
        else
        {
            member.Shifts.Clear();
        }

        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<StaffMemberDto> UpdateShiftsAsync(Guid id, UpdateShiftsRequest request, CancellationToken ct = default)
    {
        var member = await staff.Query().Include(s => s.Shifts).FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw new NotFoundException("Không tìm thấy nhân viên.");
        if (!member.IsTechnician)
            throw BookingProblems.InvalidState("Chỉ kỹ thuật viên có lịch làm việc theo ca.");
        await EnsureShiftsFitAsync(member, request.Shifts, ct);
        SetShifts(member, request.Shifts);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<StaffMemberDto> SetActiveAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        var member = await staff.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy nhân viên.");
        if (!isActive && member.IsActive)
        {
            // UC-02 E2: còn lịch tương lai thì không chuyển nghỉ việc.
            var affected = await BookingQueries.ToAffectedAsync(BookingQueries.PendingWork(lines, context.UtcNow).Where(l => l.StaffMemberId == id), ct);
            if (affected.Count > 0)
                throw BookingProblems.Conflict(
                    BookingErrorCodes.LichBiAnhHuong,
                    $"{member.FullName} còn {affected.Count} lịch hẹn sắp tới, chuyển kỹ thuật viên hoặc hủy các lịch này trước.",
                    extra: new Dictionary<string, object?> { ["affected"] = affected });
        }

        member.IsActive = isActive;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var member = await staff.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy nhân viên.");
        if (await lines.AnyAsync(l => l.StaffMemberId == id, ct)
            || await commissions.AnyAsync(c => c.StaffMemberId == id, ct)
            || await packages.AnyAsync(p => p.ConsultantStaffId == id, ct))
            throw BookingProblems.InUse("Nhân viên đã có lịch hẹn, hoa hồng; hãy chuyển sang Nghỉ việc thay vì xóa.");
        staff.Delete(member);
        await unitOfWork.SaveChangesAsync(ct);
    }

    /// <summary>BR-27: đổi ca mà lịch đã có rơi ra ngoài ca mới.</summary>
    private async Task EnsureShiftsFitAsync(StaffMember member, IReadOnlyList<ShiftType> shifts, CancellationToken ct)
    {
        var (open, close) = await context.GetHoursAsync(ct);
        var future = await BookingQueries.PendingWork(lines, context.UtcNow)
            .Where(l => l.StaffMemberId == member.Id)
            .Select(l => new { l.Id, l.StartAt, l.EndAt })
            .ToListAsync(ct);
        var outside = future.Where(l =>
        {
            var (date, start) = context.ToLocal(l.StartAt);
            var end = start + (int)(l.EndAt - l.StartAt).TotalMinutes;
            var window = BookingRules.ShiftWindow(shifts[BookingRules.IsoDayOfWeek(date) - 1], open, close);
            return window is null || start < window.Value.Start || end > window.Value.End;
        }).Select(l => l.Id).ToList();
        if (outside.Count > 0)
            throw BookingQueries.Affected(await BookingQueries.ToAffectedAsync(lines.QueryNoTracking().Where(l => outside.Contains(l.Id)), ct));
    }

    private async Task EnsureAccountAsync(Guid? userId, Guid? selfId, CancellationToken ct)
    {
        if (userId is not { } uid)
            return;
        if (!await users.AnyAsync(u => u.Id == uid, ct))
            throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure("userId", "Tài khoản không tồn tại")]);
        var other = await staff.QueryNoTracking().Where(s => s.UserId == uid && s.Id != selfId).Select(s => s.FullName).FirstOrDefaultAsync(ct);
        if (other is not null)
            throw new ConflictException($"Tài khoản đã liên kết với {other}.", "userId");
    }

    private static void SetShifts(StaffMember member, IReadOnlyList<ShiftType> shifts)
    {
        for (var day = 1; day <= 7; day++)
        {
            var row = member.Shifts.FirstOrDefault(s => s.DayOfWeek == day);
            if (row is null)
                member.Shifts.Add(new WeeklyShift { StaffMemberId = member.Id, DayOfWeek = day, Shift = shifts[day - 1] });
            else
                row.Shift = shifts[day - 1];
        }
    }

    private static void Apply(StaffMember member, SaveStaffMemberRequest request)
    {
        member.FullName = request.FullName!.Trim();
        member.Phone = Application.Validators.Booking.BookingValidationRules.Digits(request.Phone!);
        member.Kind = request.Kind;
        member.Color = request.Color!.ToUpperInvariant();
        member.Specialty = string.IsNullOrWhiteSpace(request.Specialty) ? null : request.Specialty.Trim();
        member.UserId = request.UserId;
    }

    private async Task<StaffMemberDto> GetAsync(Guid id, CancellationToken ct)
    {
        var member = await staff.QueryNoTracking().Include(s => s.Services).Include(s => s.Shifts).FirstAsync(s => s.Id == id, ct);
        var username = member.UserId is { } uid ? await users.QueryNoTracking().Where(u => u.Id == uid).Select(u => u.Username).FirstOrDefaultAsync(ct) : null;
        return ToDto(member, username);
    }

    private static StaffMemberDto ToDto(StaffMember s, string? username) => new()
    {
        Id = s.Id,
        Code = s.Code,
        FullName = s.FullName,
        Phone = s.Phone,
        Kind = s.Kind,
        Color = s.Color,
        Specialty = s.Specialty,
        UserId = s.UserId,
        Username = username,
        IsActive = s.IsActive,
        SortOrder = s.SortOrder,
        ServiceIds = s.Services.Select(x => x.ServiceId).ToList(),
        Shifts = s.IsTechnician ? Enumerable.Range(1, 7).Select(s.ShiftOn).ToList() : []
    };
}
