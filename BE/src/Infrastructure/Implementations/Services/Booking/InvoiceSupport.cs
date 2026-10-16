using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Domain.Entities.Booking;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Hr.Commissions;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Điều kiện hủy hóa đơn (BR-25, BR-26; 07 §3.7) dùng chung cho chi tiết lịch hẹn, hóa đơn, gói của khách.</summary>
internal static class InvoiceSupport
{
    public sealed record CancelBlock(string Code, string Message);

    /// <summary>Lý do không hủy được (null = hủy được), chưa xét quyền.</summary>
    public static async Task<CancelBlock?> CancelBlockAsync(
        Invoice invoice,
        Func<DateTime, DateOnly> dateOf,
        IGenericRepository<CommissionPeriod> periods,
        IGenericRepository<CustomerPackage> packages,
        IGenericRepository<PackageUsage> usages,
        CancellationToken ct)
    {
        if (invoice.Status != InvoiceStatus.DaThanhToan)
            return new CancelBlock(Application.Common.Exceptions.BookingErrorCodes.TrangThaiKhongHopLe, "Hóa đơn đã hủy");

        var month = BookingRules.MonthKey(dateOf(invoice.PaidAt));
        var status = await periods.QueryNoTracking().Where(p => p.Month == month).Select(p => (CommissionPeriodStatus?)p.Status).FirstOrDefaultAsync(ct);
        if (status is CommissionPeriodStatus.DaChot or CommissionPeriodStatus.DaChiTra)
            return new CancelBlock(Application.Common.Exceptions.BookingErrorCodes.ThangDaChot, $"Tháng {BookingRules.MonthLabel(month)} đã chốt hoa hồng");

        var sold = await packages.QueryNoTracking().Where(p => p.InvoiceId == invoice.Id).Select(p => new { p.Id, p.Code }).ToListAsync(ct);
        foreach (var package in sold)
        {
            var usedElsewhere = await usages.QueryNoTracking()
                .AnyAsync(u => u.CustomerPackageId == package.Id && !u.Refunded && u.InvoiceId != invoice.Id, ct);
            if (usedElsewhere)
                return new CancelBlock(Application.Common.Exceptions.BookingErrorCodes.GoiDaDung, $"Gói {package.Code} đã được trừ buổi ở hóa đơn khác");
        }

        return null;
    }

    public static async Task<IReadOnlyList<InvoiceBrief>> BriefsAsync(
        IReadOnlyList<Invoice> list,
        bool canCancelPermission,
        Func<DateTime, DateOnly> dateOf,
        IGenericRepository<CommissionPeriod> periods,
        IGenericRepository<CustomerPackage> packages,
        IGenericRepository<PackageUsage> usages,
        CancellationToken ct)
    {
        var result = new List<InvoiceBrief>();
        foreach (var invoice in list)
        {
            var block = await CancelBlockAsync(invoice, dateOf, periods, packages, usages, ct);
            var reason = block?.Message ?? (canCancelPermission ? null : "Chỉ chủ tiệm hủy được hóa đơn");
            result.Add(new InvoiceBrief(invoice.Id, invoice.Code, invoice.PaidAt, invoice.Total, invoice.Method, invoice.Status,
                block is null && canCancelPermission, invoice.Status == InvoiceStatus.DaThanhToan ? reason : null));
        }

        return result;
    }
}
