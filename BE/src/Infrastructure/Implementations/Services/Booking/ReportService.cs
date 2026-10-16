using Application.Common.Time;
using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.Services;
using Domain.Entities.Hr.Commissions;
using Domain.Entities.Hr.DaysOff;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Báo cáo doanh thu, dịch vụ, KTV, gói, hủy và không đến (UC-15; FR-36 đến FR-38, BR-29; 07 §3.11).</summary>
public sealed class ReportService(
    IGenericRepository<Invoice> invoices,
    IGenericRepository<InvoiceLine> invoiceLines,
    IGenericRepository<Service> services,
    IGenericRepository<StaffMember> staff,
    IGenericRepository<Commission> commissions,
    IGenericRepository<CustomerPackage> packages,
    IGenericRepository<PackageUsage> usages,
    IGenericRepository<Appointment> appointments,
    IGenericRepository<DayOff> daysOff,
    IGenericRepository<Domain.Entities.Booking.PackageTemplates.PackageTemplate> templates,
    IBookingContext context) : IReportService
{
    public async Task<RevenueReportDto> GetRevenueAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var length = to.DayNumber - from.DayNumber + 1;
        var prevTo = from.AddDays(-1);
        var prevFrom = prevTo.AddDays(-(length - 1));
        var rows = await PaidInvoicesAsync(prevFrom, to, ct);
        var days = Enumerable.Range(0, length).Select(i => from.AddDays(i)).Select(day =>
        {
            var list = rows.Where(r => r.Date == day).ToList();
            return new RevenueDayDto
            {
                Date = day,
                ServiceRevenue = list.Sum(r => r.ServiceTotal - r.Discount),
                PackageRevenue = list.Sum(r => r.PackageTotal),
                Revenue = list.Sum(r => r.Total),
                ServiceValue = list.Sum(r => r.ServiceValue),
                InvoiceCount = list.Count,
                Discount = list.Sum(r => r.Discount)
            };
        }).ToList();
        return new RevenueReportDto
        {
            From = from,
            To = to,
            Days = days,
            Totals = Totals(rows.Where(r => r.Date >= from && r.Date <= to).ToList(), from, to),
            Previous = Totals(rows.Where(r => r.Date >= prevFrom && r.Date <= prevTo).ToList(), prevFrom, prevTo)
        };
    }

    public async Task<ServiceReportDto> GetServicesAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var (start, end) = (VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to));
        var lines = await invoiceLines.QueryNoTracking()
            .Where(l => l.Kind == InvoiceLineKind.DichVu && l.Invoice!.Status == InvoiceStatus.DaThanhToan
                        && l.Invoice.PaidAt >= start && l.Invoice.PaidAt < end)
            .Select(l => new { l.ServiceId, l.BasePrice, l.UsesPackage })
            .ToListAsync(ct);
        var catalog = await services.QueryNoTracking().Include(s => s.Group).ToDictionaryAsync(s => s.Id, ct);
        if (query.GroupId is { } gid)
            lines = lines.Where(l => catalog.TryGetValue(l.ServiceId, out var s) && s.GroupId == gid).ToList();
        var totalValue = lines.Sum(l => l.BasePrice);
        var rows = lines
            .GroupBy(l => l.ServiceId)
            .Select(g =>
            {
                catalog.TryGetValue(g.Key, out var s);
                var value = g.Sum(x => x.BasePrice);
                return new ServiceReportRow(g.Key, s?.Code ?? string.Empty, s?.Name ?? string.Empty, s?.Group?.Name ?? string.Empty,
                    g.Count(), value, totalValue > 0 ? Math.Round(value * 100 / totalValue, 1) : 0, g.Count(x => x.UsesPackage));
            })
            .OrderByDescending(r => r.Value).ThenBy(r => r.Code, StringComparer.Ordinal)
            .ToList();
        return new ServiceReportDto
        {
            Rows = rows,
            TotalCount = lines.Count,
            TotalValue = totalValue,
            TotalPackageCount = lines.Count(l => l.UsesPackage)
        };
    }

    public async Task<TechnicianReportDto> GetTechniciansAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var (start, end) = (VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to));
        var lines = await invoiceLines.QueryNoTracking()
            .Where(l => l.Kind == InvoiceLineKind.DichVu && l.Invoice!.Status == InvoiceStatus.DaThanhToan
                        && l.Invoice.PaidAt >= start && l.Invoice.PaidAt < end)
            .Select(l => new { l.StaffMemberId, l.BasePrice, l.DurationMinutes })
            .ToListAsync(ct);
        var earned = await commissions.QueryNoTracking()
            .Where(c => c.EarnedAt >= start && c.EarnedAt < end)
            .GroupBy(c => c.StaffMemberId)
            .Select(g => new { g.Key, Total = g.Sum(c => c.Amount) })
            .ToListAsync(ct);
        var people = await staff.QueryNoTracking().Include(s => s.Shifts).Where(s => s.Kind == StaffKind.KyThuatVien).ToListAsync(ct);
        var offs = await daysOff.QueryNoTracking().Where(d => d.Date >= from && d.Date <= to).ToListAsync(ct);
        var (open, close) = await context.GetHoursAsync(ct);
        var lastDay = to < context.Today ? to : context.Today;

        var rows = people
            .Select(p =>
            {
                var mine = lines.Where(l => l.StaffMemberId == p.Id).ToList();
                var shiftMinutes = 0;
                for (var day = from; day <= lastDay; day = day.AddDays(1))
                {
                    if (offs.Any(o => o.Date == day && (o.StaffMemberId == null || o.StaffMemberId == p.Id)))
                        continue;
                    if (BookingRules.ShiftWindow(p.ShiftOn(BookingRules.IsoDayOfWeek(day)), open, close) is { } w)
                        shiftMinutes += w.End - w.Start;
                }

                var booked = mine.Sum(l => l.DurationMinutes);
                return new TechnicianReportRow(p.Id, p.Code, p.FullName, mine.Count, mine.Sum(l => l.BasePrice), booked, shiftMinutes,
                    shiftMinutes > 0 ? Math.Round((decimal)booked * 100 / shiftMinutes, 1) : 0,
                    earned.FirstOrDefault(e => e.Key == p.Id)?.Total ?? 0);
            })
            .Where(r => r.Count > 0 || people.First(p => p.Id == r.StaffMemberId).IsActive)
            .OrderByDescending(r => r.Value).ThenBy(r => r.Code, StringComparer.Ordinal)
            .ToList();
        return new TechnicianReportDto { Rows = rows };
    }

    public async Task<PackageReportDto> GetPackagesAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var (start, end) = (VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to));
        var sold = await invoiceLines.QueryNoTracking()
            .Where(l => l.Kind == InvoiceLineKind.BanGoi && l.Invoice!.Status == InvoiceStatus.DaThanhToan
                        && l.Invoice.PaidAt >= start && l.Invoice.PaidAt < end)
            .Select(l => new { l.PackageTemplateId, l.Description, l.Amount })
            .ToListAsync(ct);
        var used = await usages.QueryNoTracking()
            .Where(u => !u.Refunded && u.UsedAt >= start && u.UsedAt < end)
            .Select(u => u.CustomerPackage!.PackageTemplateId)
            .ToListAsync(ct);
        var all = await packages.QueryNoTracking().Include(p => p.Customer).ToListAsync(ct);
        var active = all.Where(p => p.Status == CustomerPackageStatus.DangDung).ToList();
        var catalog = await templates.QueryNoTracking().ToDictionaryAsync(t => t.Id, ct);
        var today = context.Today;
        var soon = today.AddDays(BookingRules.ExpiringSoonDays);

        var rows = sold.Where(s => s.PackageTemplateId != null).Select(s => s.PackageTemplateId!.Value)
            .Concat(used)
            .Distinct()
            .Select(tid =>
            {
                var mine = sold.Where(s => s.PackageTemplateId == tid).ToList();
                catalog.TryGetValue(tid, out var t);
                return new PackageReportRow(tid, t?.Code ?? string.Empty, t?.Name ?? mine.FirstOrDefault()?.Description ?? string.Empty,
                    mine.Count, mine.Sum(s => s.Amount), used.Count(u => u == tid));
            })
            .OrderByDescending(r => r.SoldAmount)
            .ToList();
        return new PackageReportDto
        {
            SoldCount = sold.Count,
            SoldAmount = sold.Sum(s => s.Amount),
            ActiveCount = active.Count,
            UnusedSessions = active.Sum(p => p.Remaining),
            UnusedValue = active.Sum(p => p.Remaining * p.SessionValue),
            Rows = rows,
            ExpiringSoon = active
                .Where(p => p.ExpiryDate >= today && p.ExpiryDate <= soon)
                .OrderBy(p => p.ExpiryDate)
                .Select(p => CustomerPackageService.ToDto(p, null, string.Empty, today, false))
                .ToList()
        };
    }

    public async Task<CancellationReportDto> GetCancellationsAsync(ReportRangeQuery query, CancellationToken ct = default)
    {
        var (from, to) = Range(query);
        var rows = await appointments.QueryNoTracking()
            .Where(a => a.Date >= from && a.Date <= to)
            .Select(a => new { a.Source, a.Status })
            .ToListAsync(ct);
        var total = rows.Count;
        var cancelled = rows.Count(r => r.Status == AppointmentStatus.DaHuy);
        var noShow = rows.Count(r => r.Status == AppointmentStatus.KhongDen);
        return new CancellationReportDto
        {
            Total = total,
            Cancelled = cancelled,
            NoShow = noShow,
            CancelRate = total > 0 ? Math.Round((decimal)cancelled * 100 / total, 1) : 0,
            NoShowRate = total > 0 ? Math.Round((decimal)noShow * 100 / total, 1) : 0,
            BySource = Enum.GetValues<AppointmentSource>()
                .Select(s => new CancellationSourceRow(s, rows.Count(r => r.Source == s), rows.Count(r => r.Source == s && r.Status == AppointmentStatus.DaHuy),
                    rows.Count(r => r.Source == s && r.Status == AppointmentStatus.KhongDen)))
                .ToList()
        };
    }

    private (DateOnly From, DateOnly To) Range(ReportRangeQuery query) =>
        BookingQueries.ParseRange(query.From, query.To, context.Today.AddDays(-29), context.Today);

    private sealed record PaidRow(DateOnly Date, decimal ServiceTotal, decimal PackageTotal, decimal Discount, decimal Total, decimal ServiceValue);

    private async Task<List<PaidRow>> PaidInvoicesAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var (start, end) = (VietnamDates.StartOfDayUtc(from), VietnamDates.EndOfDayExclusiveUtc(to));
        var list = await invoices.QueryNoTracking()
            .Where(i => i.Status == InvoiceStatus.DaThanhToan && i.PaidAt >= start && i.PaidAt < end)
            .Select(i => new
            {
                i.PaidAt,
                i.ServiceTotal,
                i.PackageTotal,
                i.DiscountAmount,
                i.Total,
                Value = i.Lines.Where(l => l.Kind == InvoiceLineKind.DichVu).Sum(l => l.BasePrice)
            })
            .ToListAsync(ct);
        return list.Select(i => new PaidRow(VietnamDates.DateOf(i.PaidAt), i.ServiceTotal, i.PackageTotal, i.DiscountAmount, i.Total, i.Value)).ToList();
    }

    private static RevenueTotalsDto Totals(IReadOnlyList<PaidRow> rows, DateOnly from, DateOnly to) => new()
    {
        From = from,
        To = to,
        ServiceRevenue = rows.Sum(r => r.ServiceTotal - r.Discount),
        PackageRevenue = rows.Sum(r => r.PackageTotal),
        Revenue = rows.Sum(r => r.Total),
        ServiceValue = rows.Sum(r => r.ServiceValue),
        InvoiceCount = rows.Count,
        Discount = rows.Sum(r => r.Discount)
    };
}
