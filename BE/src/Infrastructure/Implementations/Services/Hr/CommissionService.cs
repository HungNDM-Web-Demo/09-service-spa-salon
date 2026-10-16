using Application.Common.Exceptions;
using Application.DTOs.Hr;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Interfaces.Services.Hr;
using Domain.Entities.Booking;
using Domain.Entities.Hr.Commissions;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Hr;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Hr;

/// <summary>Bảng hoa hồng tháng, chốt, chi trả, hoa hồng của tôi (UC-11, UC-12; FR-31 đến FR-33, BR-25).</summary>
public sealed class CommissionService(
    IGenericRepository<Commission> commissions,
    IGenericRepository<CommissionPeriod> periods,
    IGenericRepository<StaffMember> staff,
    IBookingContext context,
    IUnitOfWork unitOfWork) : ICommissionService
{
    public async Task<CommissionSheetDto> GetSheetAsync(string? month, CancellationToken ct = default) =>
        await BuildSheetAsync(ParseMonth(month), ct);

    public async Task<IReadOnlyList<CommissionItemDto>> GetItemsAsync(CommissionItemsQuery query, CancellationToken ct = default)
    {
        var month = ParseMonth(query.Month);
        var list = await commissions.QueryNoTracking()
            .Where(c => c.Month == month && c.StaffMemberId == query.StaffMemberId)
            .OrderBy(c => c.EarnedAt).ThenBy(c => c.Kind)
            .ToListAsync(ct);
        return list.Select(ToItem).ToList();
    }

    public async Task<CommissionSheetDto> CloseAsync(string month, CancellationToken ct = default)
    {
        var key = ParseMonth(month);
        var nextMonthStart = BookingRules.MonthStart(key).AddMonths(1);
        if (context.Today < nextMonthStart)
            throw BookingProblems.Conflict(BookingErrorCodes.ChuaHetThang, $"Chỉ chốt từ {BookingRules.FormatDate(nextMonthStart)}");
        var period = await GetOrCreateAsync(key, ct);
        if (period.Status != CommissionPeriodStatus.TamTinh)
            throw BookingProblems.InvalidState($"Bảng hoa hồng tháng {BookingRules.MonthLabel(key)} đã chốt.");
        var actor = await context.GetActorAsync(ct);
        period.Status = CommissionPeriodStatus.DaChot;
        period.ClosedAt = context.UtcNow;
        period.ClosedByName = actor.FullName;
        await unitOfWork.SaveChangesAsync(ct);
        return await BuildSheetAsync(key, ct);
    }

    public async Task<CommissionSheetDto> PayAsync(string month, CancellationToken ct = default)
    {
        var key = ParseMonth(month);
        var period = await GetOrCreateAsync(key, ct);
        if (period.Status != CommissionPeriodStatus.DaChot)
            throw BookingProblems.InvalidState("Chỉ đánh dấu đã chi trả khi bảng hoa hồng đã chốt.");
        var actor = await context.GetActorAsync(ct);
        period.Status = CommissionPeriodStatus.DaChiTra;
        period.PaidAt = context.UtcNow;
        period.PaidByName = actor.FullName;
        await unitOfWork.SaveChangesAsync(ct);
        return await BuildSheetAsync(key, ct);
    }

    public async Task<MyCommissionsDto> GetMineAsync(string? month, CancellationToken ct = default)
    {
        var key = ParseMonth(month);
        var member = await CurrentStaffAsync(ct);
        var list = await commissions.QueryNoTracking()
            .Where(c => c.Month == key && c.StaffMemberId == member.Id)
            .OrderByDescending(c => c.EarnedAt)
            .ToListAsync(ct);
        var status = await periods.QueryNoTracking().Where(p => p.Month == key).Select(p => (CommissionPeriodStatus?)p.Status).FirstOrDefaultAsync(ct);
        return new MyCommissionsDto
        {
            Month = BookingRules.MonthText(key),
            Status = status ?? CommissionPeriodStatus.TamTinh,
            Total = list.Sum(c => c.Amount),
            ServiceCommission = list.Where(c => c.Kind == CommissionKind.DichVu).Sum(c => c.Amount),
            PackageCommission = list.Where(c => c.Kind == CommissionKind.BanGoi).Sum(c => c.Amount),
            Items = list.Select(ToItem).ToList()
        };
    }

    /// <summary>KTV liên kết với tài khoản đang đăng nhập.</summary>
    private async Task<StaffMember> CurrentStaffAsync(CancellationToken ct)
    {
        var actor = await context.GetActorAsync(ct);
        return await staff.QueryNoTracking().FirstOrDefaultAsync(s => s.UserId == actor.UserId, ct)
               ?? throw new NotFoundException("Tài khoản chưa liên kết với nhân viên nào.");
    }

    private int ParseMonth(string? month) =>
        BookingRules.TryParseMonth(month, out var key) ? key : BookingRules.MonthKey(context.Today);

    private async Task<CommissionPeriod> GetOrCreateAsync(int month, CancellationToken ct)
    {
        var period = await periods.Query().FirstOrDefaultAsync(p => p.Month == month, ct);
        if (period is not null)
            return period;
        period = new CommissionPeriod { Month = month, Code = BookingRules.CommissionPeriodCode(month), Status = CommissionPeriodStatus.TamTinh };
        await periods.AddAsync(period, ct);
        return period;
    }

    private async Task<CommissionSheetDto> BuildSheetAsync(int month, CancellationToken ct)
    {
        var period = await periods.QueryNoTracking().FirstOrDefaultAsync(p => p.Month == month, ct);
        var list = await commissions.QueryNoTracking().Where(c => c.Month == month).ToListAsync(ct);
        var people = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, ct);
        var rows = list
            .GroupBy(c => c.StaffMemberId)
            .Select(g => Row(g.ToList(), people.GetValueOrDefault(g.Key)))
            .OrderByDescending(r => r.Total).ThenBy(r => r.StaffCode, StringComparer.Ordinal)
            .ToList();
        var status = period?.Status ?? CommissionPeriodStatus.TamTinh;
        var nextMonthStart = BookingRules.MonthStart(month).AddMonths(1);
        string? blocked = status != CommissionPeriodStatus.TamTinh
            ? null
            : context.Today < nextMonthStart ? $"Chỉ chốt từ {BookingRules.FormatDate(nextMonthStart)}" : null;
        return new CommissionSheetDto
        {
            Month = BookingRules.MonthText(month),
            Code = period?.Code ?? BookingRules.CommissionPeriodCode(month),
            Status = status,
            ClosedAt = period?.ClosedAt,
            ClosedByName = period?.ClosedByName,
            PaidAt = period?.PaidAt,
            PaidByName = period?.PaidByName,
            CanClose = status == CommissionPeriodStatus.TamTinh && blocked is null,
            CloseBlockedReason = blocked,
            Rows = rows,
            Totals = Row(list, null)
        };
    }

    private static CommissionRowDto Row(IReadOnlyList<Commission> items, StaffMember? member)
    {
        var service = items.Where(c => c.Kind == CommissionKind.DichVu).ToList();
        var package = items.Where(c => c.Kind == CommissionKind.BanGoi).ToList();
        return new CommissionRowDto
        {
            StaffMemberId = member?.Id,
            StaffCode = member?.Code,
            StaffName = member?.FullName,
            ServiceCount = service.Count,
            ServiceBase = service.Sum(c => c.BaseAmount),
            ServiceCommission = service.Sum(c => c.Amount),
            PackageCount = package.Count,
            PackageCommission = package.Sum(c => c.Amount),
            Total = items.Sum(c => c.Amount)
        };
    }

    private static CommissionItemDto ToItem(Commission c) => new()
    {
        Id = c.Id,
        EarnedAt = c.EarnedAt,
        InvoiceId = c.InvoiceId,
        InvoiceCode = c.InvoiceCode,
        AppointmentId = c.AppointmentId,
        CustomerName = c.CustomerName,
        Kind = c.Kind,
        Description = c.Description,
        BaseAmount = c.BaseAmount,
        RateType = c.RateType,
        RateValue = c.RateValue,
        Amount = c.Amount
    };
}
