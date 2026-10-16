using Application.Common.Exceptions;
using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.PackageTemplates;
using Domain.Entities.Booking.Services;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Gói mẫu (UC-01 1b; 07 §4.2). Màn hình hiện giá lẻ tương đương, tiết kiệm, giá trị một buổi (FR-04, BR-22).</summary>
public sealed class PackageTemplateService(
    IGenericRepository<PackageTemplate> templates,
    IGenericRepository<Service> services,
    IGenericRepository<CustomerPackage> customerPackages,
    IUnitOfWork unitOfWork) : IPackageTemplateService
{
    public async Task<IReadOnlyList<PackageTemplateDto>> GetAllAsync(CancellationToken ct = default) =>
        await ListAsync(templates.QueryNoTracking(), ct);

    public async Task<IReadOnlyList<PackageTemplateDto>> GetOptionsAsync(CancellationToken ct = default) =>
        await ListAsync(templates.QueryNoTracking().Where(t => t.IsActive), ct);

    public async Task<NextCodeDto> NextCodeAsync(CancellationToken ct = default) =>
        new(BookingQueries.NextCatalogCode(await templates.QueryNoTracking().Select(t => t.Code).ToListAsync(ct), "GOI", 2));

    public async Task<PackageTemplateDto> CreateAsync(SavePackageTemplateRequest request, CancellationToken ct = default)
    {
        var code = request.Code!.Trim();
        if (await templates.AnyAsync(t => t.Code == code, ct))
            throw new ConflictException($"Mã gói {code} đã tồn tại.", "code");
        await EnsureServiceAsync(request.ServiceId, ct);
        var template = new PackageTemplate { Code = code };
        Apply(template, request);
        await templates.AddAsync(template, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(template.Id, ct);
    }

    public async Task<PackageTemplateDto> UpdateAsync(Guid id, SavePackageTemplateRequest request, CancellationToken ct = default)
    {
        var template = await templates.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy gói mẫu.");
        var code = request.Code!.Trim();
        if (await templates.AnyAsync(t => t.Code == code && t.Id != id, ct))
            throw new ConflictException($"Mã gói {code} đã tồn tại.", "code");
        await EnsureServiceAsync(request.ServiceId, ct);
        template.Code = code;
        Apply(template, request);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<PackageTemplateDto> SetActiveAsync(Guid id, bool isActive, CancellationToken ct = default)
    {
        var template = await templates.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy gói mẫu.");
        template.IsActive = isActive;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var template = await templates.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy gói mẫu.");
        if (await customerPackages.AnyAsync(p => p.PackageTemplateId == id, ct))
            throw BookingProblems.InUse("Gói mẫu đã bán cho khách; hãy dùng Ngừng bán thay vì xóa.");
        templates.Delete(template);
        await unitOfWork.SaveChangesAsync(ct);
    }

    private async Task<PackageTemplateDto> GetAsync(Guid id, CancellationToken ct) =>
        (await ListAsync(templates.QueryNoTracking().Where(t => t.Id == id), ct)).Single();

    private async Task<List<PackageTemplateDto>> ListAsync(IQueryable<PackageTemplate> query, CancellationToken ct)
    {
        var list = await query.Include(t => t.Service).ToListAsync(ct);
        var ids = list.Select(t => t.Id).ToList();
        var sold = await customerPackages.QueryNoTracking()
            .Where(p => ids.Contains(p.PackageTemplateId))
            .GroupBy(p => p.PackageTemplateId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToListAsync(ct);
        return list
            .OrderBy(t => t.Code, StringComparer.Ordinal)
            .Select(t => ToDto(t, sold.FirstOrDefault(s => s.Key == t.Id)?.Count ?? 0))
            .ToList();
    }

    private async Task EnsureServiceAsync(Guid serviceId, CancellationToken ct)
    {
        if (!await services.AnyAsync(s => s.Id == serviceId, ct))
            throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure("serviceId", "Chọn dịch vụ áp dụng")]);
    }

    private static void Apply(PackageTemplate t, SavePackageTemplateRequest r)
    {
        t.Name = r.Name!.Trim();
        t.ServiceId = r.ServiceId;
        t.Sessions = r.Sessions;
        t.Price = r.Price;
        t.ValidityMonths = r.ValidityMonths;
        t.MinIntervalDays = r.MinIntervalDays;
        t.CommissionRate = r.CommissionRate;
        t.IsActive = r.IsActive;
    }

    internal static PackageTemplateDto ToDto(PackageTemplate t, int soldCount)
    {
        var servicePrice = t.Service?.Price ?? 0;
        var retail = servicePrice * t.Sessions;
        var saving = retail - t.Price;
        return new PackageTemplateDto
        {
            Id = t.Id,
            Code = t.Code,
            Name = t.Name,
            ServiceId = t.ServiceId,
            ServiceCode = t.Service?.Code ?? string.Empty,
            ServiceName = t.Service?.Name ?? string.Empty,
            ServicePrice = servicePrice,
            Sessions = t.Sessions,
            Price = t.Price,
            ValidityMonths = t.ValidityMonths,
            MinIntervalDays = t.MinIntervalDays,
            CommissionRate = t.CommissionRate,
            IsActive = t.IsActive,
            RetailEquivalent = retail,
            SavingAmount = saving,
            SavingPercent = retail > 0 ? Math.Round(saving * 100 / retail, 1) : 0,
            SessionValue = BookingRules.SessionValue(t.Price, t.Sessions),
            SoldCount = soldCount
        };
    }
}
