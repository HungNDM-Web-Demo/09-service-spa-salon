using API.Base;
using API.Filters;
using Application.DTOs.Booking;
using Application.Interfaces.Services.Booking;
using Microsoft.AspNetCore.Mvc;
using P = Application.Constants.ProjectPermissions;

namespace API.Controllers.Booking;

/// <summary>Gốc của controller nghiệp vụ Spa: đưa <c>code</c> của lỗi 404, 429 vào ProblemDetails.</summary>
[BookingProblem]
public abstract class BookingControllerBase : BaseApiController
{
    /// <summary>Tạo mới trả 201; gửi lại cùng <c>clientRequestId</c> trả 200 kèm bản đã tạo.</summary>
    protected IActionResult CreatedOrOk<T>(CreateResult<T> result) =>
        result.Created ? StatusCode(StatusCodes.Status201Created, result.Value) : Ok(result.Value);
}

/// <summary>Nhóm dịch vụ (07 §4.1).</summary>
[Route("api/service-groups")]
public sealed class ServiceGroupsController(IServiceCatalogService service) : BookingControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Services.View)]
    public Task<IReadOnlyList<ServiceGroupDto>> GetAll(CancellationToken ct) => service.GetGroupsAsync(ct);

    [HttpPost]
    [AuthorizePermission(P.Services.Create)]
    public async Task<IActionResult> Create(SaveServiceGroupRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateGroupAsync(request, ct));

    [HttpPut("order")]
    [AuthorizePermission(P.Services.Update)]
    public async Task<IActionResult> Reorder(ReorderRequest request, CancellationToken ct)
    {
        await service.ReorderGroupsAsync(request, ct);
        return NoContent();
    }

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Services.Update)]
    public Task<ServiceGroupDto> Update(Guid id, SaveServiceGroupRequest request, CancellationToken ct) => service.UpdateGroupAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.Services.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteGroupAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Dịch vụ, bảng giá (07 §4.1).</summary>
[Route("api/services")]
public sealed class ServicesController(IServiceCatalogService service) : BookingControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Services.View)]
    public Task<IReadOnlyList<ServiceDto>> GetAll([FromQuery] Guid? groupId, [FromQuery] bool? visible, CancellationToken ct) =>
        service.GetServicesAsync(groupId, visible, ct);

    [HttpGet("options")]
    [AuthorizePermission(P.Appointments.View, P.Appointments.Create, P.CustomerPackages.Sell, P.Packages.View)]
    public Task<IReadOnlyList<ServiceOption>> GetOptions(CancellationToken ct) => service.GetOptionsAsync(ct);

    [HttpGet("next-code")]
    [AuthorizePermission(P.Services.Create)]
    public Task<NextCodeDto> NextCode(CancellationToken ct) => service.NextCodeAsync(ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Services.View)]
    public Task<ServiceDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.Services.Create)]
    public async Task<IActionResult> Create(SaveServiceRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Services.Update)]
    public Task<ServiceDto> Update(Guid id, SaveServiceRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/visibility")]
    [AuthorizePermission(P.Services.Update)]
    public Task<ServiceDto> SetVisibility(Guid id, SetVisibilityRequest request, CancellationToken ct) =>
        service.SetVisibilityAsync(id, request.IsVisible, ct);

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.Services.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Gói mẫu (07 §4.2).</summary>
[Route("api/package-templates")]
public sealed class PackageTemplatesController(IPackageTemplateService service) : BookingControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Packages.View)]
    public Task<IReadOnlyList<PackageTemplateDto>> GetAll(CancellationToken ct) => service.GetAllAsync(ct);

    [HttpGet("options")]
    [AuthorizePermission(P.CustomerPackages.Sell, P.Packages.View)]
    public Task<IReadOnlyList<PackageTemplateDto>> GetOptions(CancellationToken ct) => service.GetOptionsAsync(ct);

    [HttpGet("next-code")]
    [AuthorizePermission(P.Packages.Create)]
    public Task<NextCodeDto> NextCode(CancellationToken ct) => service.NextCodeAsync(ct);

    [HttpPost]
    [AuthorizePermission(P.Packages.Create)]
    public async Task<IActionResult> Create(SavePackageTemplateRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Packages.Update)]
    public Task<PackageTemplateDto> Update(Guid id, SavePackageTemplateRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/status")]
    [AuthorizePermission(P.Packages.Update)]
    public Task<PackageTemplateDto> SetStatus(Guid id, SetActiveRequest request, CancellationToken ct) => service.SetActiveAsync(id, request.IsActive, ct);

    [HttpDelete("{id:guid}")]
    [AuthorizePermission(P.Packages.Delete)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Giờ mở cửa (FR-07, 07 §4.3).</summary>
[Route("api/business-hours")]
public sealed class BusinessHoursController(IBusinessHoursService service) : BookingControllerBase
{
    [HttpGet]
    public Task<BusinessHoursDto> Get(CancellationToken ct) => service.GetAsync(ct);

    [HttpPut]
    [AuthorizePermission(P.StaffMembers.Update)]
    public Task<BusinessHoursDto> Update(UpdateBusinessHoursRequest request, CancellationToken ct) => service.UpdateAsync(request, ct);
}

/// <summary>Thông tin tiệm cho bản in hóa đơn và QR chuyển khoản (07 §4.3).</summary>
[Route("api/store-profile")]
public sealed class StoreProfileController(IBusinessHoursService service) : BookingControllerBase
{
    [HttpGet]
    public Task<StoreProfileDto> Get(CancellationToken ct) => service.GetStoreProfileAsync(ct);
}
