using Application.Common.Exceptions;
using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.PackageTemplates;
using Domain.Entities.Booking.Services;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Hr;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Nhóm dịch vụ, dịch vụ (UC-01; 07 §4.1).</summary>
public sealed class ServiceCatalogService(
    IGenericRepository<ServiceGroup> groups,
    IGenericRepository<Service> services,
    IGenericRepository<StaffMember> staff,
    IGenericRepository<AppointmentLine> appointmentLines,
    IGenericRepository<PackageTemplate> templates,
    IGenericRepository<InvoiceLine> invoiceLines,
    IUnitOfWork unitOfWork) : IServiceCatalogService
{
    public async Task<IReadOnlyList<ServiceGroupDto>> GetGroupsAsync(CancellationToken ct = default)
    {
        var counts = await services.QueryNoTracking().GroupBy(s => s.GroupId).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var list = await groups.QueryNoTracking().OrderBy(g => g.SortOrder).ThenBy(g => g.Name).ToListAsync(ct);
        return list.Select(g => ToDto(g, counts.FirstOrDefault(c => c.Key == g.Id)?.Count ?? 0)).ToList();
    }

    public async Task<ServiceGroupDto> CreateGroupAsync(SaveServiceGroupRequest request, CancellationToken ct = default)
    {
        var name = request.Name!.Trim();
        if (await groups.AnyAsync(g => g.Name == name, ct))
            throw new ConflictException($"Nhóm {name} đã có.", "name");
        var max = await groups.QueryNoTracking().Select(g => (int?)g.SortOrder).MaxAsync(ct) ?? 0;
        var group = new ServiceGroup { Name = name, IsVisible = request.IsVisible, SortOrder = max + 10 };
        await groups.AddAsync(group, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(group, 0);
    }

    public async Task<ServiceGroupDto> UpdateGroupAsync(Guid id, SaveServiceGroupRequest request, CancellationToken ct = default)
    {
        var group = await groups.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy nhóm dịch vụ.");
        var name = request.Name!.Trim();
        if (await groups.AnyAsync(g => g.Name == name && g.Id != id, ct))
            throw new ConflictException($"Nhóm {name} đã có.", "name");
        group.Name = name;
        group.IsVisible = request.IsVisible;
        await unitOfWork.SaveChangesAsync(ct);
        return ToDto(group, await services.QueryNoTracking().CountAsync(s => s.GroupId == id, ct));
    }

    public async Task ReorderGroupsAsync(ReorderRequest request, CancellationToken ct = default)
    {
        var list = await groups.Query().ToListAsync(ct);
        var order = request.Ids.Concat(list.Select(g => g.Id).Where(id => !request.Ids.Contains(id))).ToList();
        foreach (var group in list)
            group.SortOrder = (order.IndexOf(group.Id) + 1) * 10;
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task DeleteGroupAsync(Guid id, CancellationToken ct = default)
    {
        var group = await groups.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy nhóm dịch vụ.");
        if (await services.AnyAsync(s => s.GroupId == id, ct))
            throw BookingProblems.InUse("Nhóm còn dịch vụ, chuyển hoặc xóa các dịch vụ trước.");
        groups.Delete(group);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<ServiceDto>> GetServicesAsync(Guid? groupId, bool? visible, CancellationToken ct = default)
    {
        var query = services.QueryNoTracking().Include(s => s.Group).AsQueryable();
        if (groupId is { } g)
            query = query.Where(s => s.GroupId == g);
        if (visible is { } v)
            query = query.Where(s => s.IsVisible == v);
        var list = await query.ToListAsync(ct);
        var technicians = await TechnicianMapAsync(ct);
        return list
            .OrderBy(s => s.Group!.SortOrder).ThenBy(s => s.Code, StringComparer.Ordinal)
            .Select(s => ToDto(s, technicians.GetValueOrDefault(s.Id)?.Count ?? 0))
            .ToList();
    }

    public async Task<IReadOnlyList<ServiceOption>> GetOptionsAsync(CancellationToken ct = default)
    {
        var list = await services.QueryNoTracking().Include(s => s.Group)
            .Where(s => s.IsVisible && s.Group!.IsVisible)
            .ToListAsync(ct);
        var technicians = await TechnicianMapAsync(ct);
        return list
            .OrderBy(s => s.Group!.SortOrder).ThenBy(s => s.Code, StringComparer.Ordinal)
            .Select(s => new ServiceOption(s.Id, s.Code, s.Name, s.GroupId, s.Group!.Name, s.DurationMinutes, s.CleanupMinutes, s.Price,
                technicians.GetValueOrDefault(s.Id) ?? []))
            .ToList();
    }

    public async Task<NextCodeDto> NextCodeAsync(CancellationToken ct = default) =>
        new(BookingQueries.NextCatalogCode(await services.QueryNoTracking().Select(s => s.Code).ToListAsync(ct), "DV", 3));

    public async Task<ServiceDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var service = await services.QueryNoTracking().Include(s => s.Group).FirstOrDefaultAsync(s => s.Id == id, ct)
                      ?? throw new NotFoundException("Không tìm thấy dịch vụ.");
        var technicians = await TechnicianMapAsync(ct);
        return ToDto(service, technicians.GetValueOrDefault(id)?.Count ?? 0);
    }

    public async Task<ServiceDto> CreateAsync(SaveServiceRequest request, CancellationToken ct = default)
    {
        var code = request.Code!.Trim();
        if (await services.AnyAsync(s => s.Code == code, ct))
            throw new ConflictException($"Mã dịch vụ {code} đã tồn tại.", "code");
        await EnsureGroupAsync(request.GroupId, ct);
        var service = new Service { Code = code };
        Apply(service, request);
        await services.AddAsync(service, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(service.Id, ct);
    }

    public async Task<ServiceDto> UpdateAsync(Guid id, SaveServiceRequest request, CancellationToken ct = default)
    {
        var service = await services.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy dịch vụ.");
        var code = request.Code!.Trim();
        if (await services.AnyAsync(s => s.Code == code && s.Id != id, ct))
            throw new ConflictException($"Mã dịch vụ {code} đã tồn tại.", "code");
        await EnsureGroupAsync(request.GroupId, ct);
        service.Code = code;
        Apply(service, request);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<ServiceDto> SetVisibilityAsync(Guid id, bool isVisible, CancellationToken ct = default)
    {
        var service = await services.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy dịch vụ.");
        service.IsVisible = isVisible;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var service = await services.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy dịch vụ.");
        if (await appointmentLines.AnyAsync(l => l.ServiceId == id, ct) || await invoiceLines.AnyAsync(l => l.ServiceId == id, ct))
            throw BookingProblems.InUse("Dịch vụ đã có lịch hẹn, hóa đơn; hãy dùng Ẩn thay vì xóa.");
        if (await templates.AnyAsync(t => t.ServiceId == id, ct))
            throw BookingProblems.InUse("Dịch vụ đang có gói mẫu; hãy dùng Ẩn thay vì xóa.");
        services.Delete(service);
        await unitOfWork.SaveChangesAsync(ct);
    }

    /// <summary>Dịch vụ → KTV đang làm việc làm được.</summary>
    private async Task<Dictionary<Guid, List<Guid>>> TechnicianMapAsync(CancellationToken ct)
    {
        var people = await staff.QueryNoTracking().Include(s => s.Services)
            .Where(s => s.IsActive && s.Kind == StaffKind.KyThuatVien)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Code)
            .ToListAsync(ct);
        return people
            .SelectMany(s => s.Services.Select(x => (x.ServiceId, StaffId: s.Id)))
            .GroupBy(x => x.ServiceId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.StaffId).ToList());
    }

    private async Task EnsureGroupAsync(Guid groupId, CancellationToken ct)
    {
        if (!await groups.AnyAsync(g => g.Id == groupId, ct))
            throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure("groupId", "Chọn nhóm dịch vụ")]);
    }

    private static void Apply(Service service, SaveServiceRequest request)
    {
        service.Name = request.Name!.Trim();
        service.GroupId = request.GroupId;
        service.DurationMinutes = request.DurationMinutes;
        service.CleanupMinutes = request.CleanupMinutes;
        service.Price = request.Price;
        service.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        service.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
        service.AllowOnline = request.AllowOnline;
        service.CommissionType = request.CommissionType;
        service.CommissionValue = request.CommissionValue;
        service.IsVisible = request.IsVisible;
    }

    private static ServiceGroupDto ToDto(ServiceGroup g, int count) => new()
    {
        Id = g.Id,
        Name = g.Name,
        SortOrder = g.SortOrder,
        IsVisible = g.IsVisible,
        ServiceCount = count
    };

    /// <summary>UC-01 E4: dịch vụ bật đặt online mà chưa hiện trên trang đặt lịch thì nêu lý do (BR-06).</summary>
    public static string? OnlineWarning(Service s, int technicianCount)
    {
        if (!s.AllowOnline)
            return null;
        if (!s.IsVisible)
            return "Dịch vụ đang ẩn nên chưa hiện trên trang đặt lịch";
        if (s.Group is { IsVisible: false })
            return "Nhóm dịch vụ đang ẩn nên dịch vụ chưa hiện trên trang đặt lịch";
        return technicianCount == 0 ? "Dịch vụ chưa hiện trên trang đặt lịch vì chưa có kỹ thuật viên" : null;
    }

    private static ServiceDto ToDto(Service s, int technicianCount) => new()
    {
        Id = s.Id,
        Code = s.Code,
        Name = s.Name,
        GroupId = s.GroupId,
        GroupName = s.Group?.Name ?? string.Empty,
        DurationMinutes = s.DurationMinutes,
        CleanupMinutes = s.CleanupMinutes,
        Price = s.Price,
        Description = s.Description,
        ImageUrl = s.ImageUrl,
        AllowOnline = s.AllowOnline,
        CommissionType = s.CommissionType,
        CommissionValue = s.CommissionValue,
        IsVisible = s.IsVisible,
        TechnicianCount = technicianCount,
        OnlineWarning = OnlineWarning(s, technicianCount),
        CreatedAt = s.CreatedAt
    };
}
