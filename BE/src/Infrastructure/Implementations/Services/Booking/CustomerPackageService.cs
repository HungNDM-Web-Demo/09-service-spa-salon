using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Constants;
using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Validators.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Enums.Booking;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Gói của khách, lịch sử trừ buổi, gia hạn (FR-28, FR-29; 07 §4.7).</summary>
public sealed class CustomerPackageService(
    IGenericRepository<CustomerPackage> packages,
    IGenericRepository<PackageUsage> usages,
    IGenericRepository<Invoice> invoices,
    IBookingContext context,
    IUnitOfWork unitOfWork) : ICustomerPackageService
{
    public async Task<PaginatedResult<CustomerPackageDto>> GetPagedAsync(CustomerPackageQuery query, CancellationToken ct = default)
    {
        var source = packages.QueryNoTracking().Include(p => p.Customer).AsQueryable();
        if (query.CustomerId is { } cid)
            source = source.Where(p => p.CustomerId == cid);
        if (query.Status is { } status)
            source = source.Where(p => p.Status == status);
        var today = context.Today;
        switch (query.Filter)
        {
            case "expiringSoon":
                var limit = today.AddDays(BookingRules.ExpiringSoonDays);
                source = source.Where(p => p.Status == CustomerPackageStatus.DangDung && p.ExpiryDate >= today && p.ExpiryDate <= limit);
                break;
            case "lastSession":
                source = source.Where(p => p.Status == CustomerPackageStatus.DangDung && p.TotalSessions - p.UsedSessions == 1);
                break;
        }

        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            var digits = BookingValidationRules.Digits(term);
            var phonePattern = LikePattern.Contains(digits.Length > 0 ? digits : term);
            source = source.Where(p => AppDbFunctions.Matches(p.Code, pattern) || AppDbFunctions.Matches(p.PackageName, pattern)
                                       || AppDbFunctions.Matches(p.Customer!.FullName, pattern) || AppDbFunctions.Matches(p.Customer.Phone, phonePattern));
        }

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = "purchasedAt";
        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var dtos = await ToDtosAsync(page.Items, ct);
        return page.Map(_ => dtos);
    }

    public async Task<CustomerPackageDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var package = await packages.QueryNoTracking().Include(p => p.Customer).FirstOrDefaultAsync(p => p.Id == id, ct)
                      ?? throw new NotFoundException("Không tìm thấy gói của khách.");
        var dto = (await ToDtosAsync([package], ct)).Single();
        var history = await usages.QueryNoTracking().Where(u => u.CustomerPackageId == id).OrderByDescending(u => u.UsedAt).ToListAsync(ct);
        var invoiceIds = history.Select(u => u.InvoiceId).Distinct().ToList();
        var codes = await invoices.QueryNoTracking().Where(i => invoiceIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id, i => i.Code, ct);
        return new CustomerPackageDetailDto
        {
            Id = dto.Id,
            Code = dto.Code,
            PackageName = dto.PackageName,
            ServiceId = dto.ServiceId,
            ServiceName = dto.ServiceName,
            TotalSessions = dto.TotalSessions,
            UsedSessions = dto.UsedSessions,
            Remaining = dto.Remaining,
            ExpiryDate = dto.ExpiryDate,
            Status = dto.Status,
            SessionValue = dto.SessionValue,
            MinIntervalDays = dto.MinIntervalDays,
            LastUsedAt = dto.LastUsedAt,
            PurchasedAt = dto.PurchasedAt,
            CustomerId = dto.CustomerId,
            CustomerCode = dto.CustomerCode,
            CustomerName = dto.CustomerName,
            CustomerPhone = dto.CustomerPhone,
            PackageTemplateId = dto.PackageTemplateId,
            Price = dto.Price,
            ExtendedDays = dto.ExtendedDays,
            ExtendReason = dto.ExtendReason,
            ConsultantName = dto.ConsultantName,
            InvoiceId = dto.InvoiceId,
            InvoiceCode = dto.InvoiceCode,
            ExpiringSoon = dto.ExpiringSoon,
            CanExtend = dto.CanExtend,
            Usages = history.Select(u => new PackageUsageDto(u.Id, u.UsedAt, u.AppointmentId, u.AppointmentCode,
                codes.GetValueOrDefault(u.InvoiceId, string.Empty), u.StaffName, u.OverrideReason, u.Refunded)).ToList()
        };
    }

    public async Task<CustomerPackageDetailDto> ExtendAsync(Guid id, ExtendPackageRequest request, CancellationToken ct = default)
    {
        var package = await packages.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy gói của khách.");
        if (package.ExtendedDays is not null)
            throw BookingProblems.InvalidState("Gói đã gia hạn một lần, không gia hạn thêm được.");
        if (package.Status is not (CustomerPackageStatus.DangDung or CustomerPackageStatus.HetHan))
            throw BookingProblems.InvalidState("Chỉ gia hạn gói đang dùng hoặc đã hết hạn còn buổi.");
        var actor = await context.GetActorAsync(ct);
        package.ExpiryDate = package.ExpiryDate.AddDays(request.Days);
        package.ExtendedDays = request.Days;
        package.ExtendReason = request.Reason!.Trim();
        package.ExtendedAt = context.UtcNow;
        package.ExtendedByName = actor.FullName;
        if (package.Status == CustomerPackageStatus.HetHan && package.Remaining > 0 && package.ExpiryDate >= context.Today)
            package.Status = CustomerPackageStatus.DangDung;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    internal async Task<List<CustomerPackageDto>> ToDtosAsync(IReadOnlyList<CustomerPackage> list, CancellationToken ct)
    {
        var actor = await context.GetActorAsync(ct);
        var ids = list.Select(p => p.Id).ToList();
        var last = await usages.QueryNoTracking()
            .Where(u => ids.Contains(u.CustomerPackageId) && !u.Refunded)
            .GroupBy(u => u.CustomerPackageId)
            .Select(g => new { g.Key, Last = g.Max(u => u.UsedAt) })
            .ToListAsync(ct);
        var invoiceIds = list.Select(p => p.InvoiceId).Distinct().ToList();
        var codes = await invoices.QueryNoTracking().Where(i => invoiceIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id, i => i.Code, ct);
        var today = context.Today;
        var canExtend = actor.Has(ProjectPermissions.CustomerPackages.Extend);
        return list.Select(p => ToDto(p, last.FirstOrDefault(x => x.Key == p.Id)?.Last, codes.GetValueOrDefault(p.InvoiceId, string.Empty), today, canExtend)).ToList();
    }

    internal static CustomerPackageDto ToDto(CustomerPackage p, DateTime? lastUsedAt, string invoiceCode, DateOnly today, bool canExtendPermission) => new()
    {
        Id = p.Id,
        Code = p.Code,
        PackageName = p.PackageName,
        ServiceId = p.ServiceId,
        ServiceName = p.ServiceName,
        TotalSessions = p.TotalSessions,
        UsedSessions = p.UsedSessions,
        Remaining = p.Remaining,
        ExpiryDate = p.ExpiryDate,
        Status = p.Status,
        SessionValue = p.SessionValue,
        MinIntervalDays = p.MinIntervalDays,
        LastUsedAt = lastUsedAt,
        PurchasedAt = p.PurchasedAt,
        CustomerId = p.CustomerId,
        CustomerCode = p.Customer?.Code ?? string.Empty,
        CustomerName = p.Customer?.FullName ?? string.Empty,
        CustomerPhone = p.Customer?.Phone ?? string.Empty,
        PackageTemplateId = p.PackageTemplateId,
        Price = p.Price,
        ExtendedDays = p.ExtendedDays,
        ExtendReason = p.ExtendReason,
        ConsultantName = p.ConsultantName,
        InvoiceId = p.InvoiceId,
        InvoiceCode = invoiceCode,
        ExpiringSoon = p.Status == CustomerPackageStatus.DangDung && p.ExpiryDate >= today && p.ExpiryDate <= today.AddDays(BookingRules.ExpiringSoonDays),
        CanExtend = canExtendPermission && p.ExtendedDays is null && p.Status is CustomerPackageStatus.DangDung or CustomerPackageStatus.HetHan
    };
}
