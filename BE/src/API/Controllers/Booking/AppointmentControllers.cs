using API.Filters;
using Application.Common.Models;
using Application.DTOs.Booking;
using Application.Interfaces.Services.Booking;
using Application.Interfaces.Services.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using P = Application.Constants.ProjectPermissions;

namespace API.Controllers.Booking;

/// <summary>Lịch hẹn: lưới, tạo, sửa, kéo thả, xác nhận, hủy, check-in, không đến (07 §4.4).</summary>
[Route("api/appointments")]
public sealed class AppointmentsController(IAppointmentService service) : BookingControllerBase
{
    [HttpGet("board")]
    [AuthorizePermission(P.Appointments.View)]
    public Task<BoardDto> GetBoard([FromQuery] string? date, CancellationToken ct) => service.GetBoardAsync(date, ct);

    [HttpGet]
    [AuthorizePermission(P.Appointments.View)]
    public Task<PaginatedResult<AppointmentListItem>> GetPaged([FromQuery] AppointmentQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Appointments.View)]
    public Task<AppointmentDetailDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost("check")]
    [AuthorizePermission(P.Appointments.Create, P.Appointments.Update)]
    public Task<CheckResultDto> Check(CheckAppointmentRequest request, CancellationToken ct) => service.CheckAsync(request, ct);

    [HttpGet("suggestions")]
    [AuthorizePermission(P.Appointments.Create, P.Appointments.Update)]
    public Task<SuggestionsDto> Suggest([FromQuery] SuggestionQuery query, CancellationToken ct) => service.SuggestAsync(query, ct);

    [HttpPost]
    [AuthorizePermission(P.Appointments.Create)]
    public async Task<IActionResult> Create(CreateAppointmentRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Appointments.Update)]
    public Task<AppointmentDetailDto> Update(Guid id, UpdateAppointmentRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/lines/{lineId:guid}")]
    [AuthorizePermission(P.Appointments.Update)]
    public Task<AppointmentDetailDto> MoveLine(Guid id, Guid lineId, MoveLineRequest request, CancellationToken ct) =>
        service.MoveLineAsync(id, lineId, request, ct);

    [HttpPost("{id:guid}/confirm")]
    [AuthorizePermission(P.Appointments.Update)]
    public Task<AppointmentDetailDto> Confirm(Guid id, CancellationToken ct) => service.ConfirmAsync(id, ct);

    [HttpPost("{id:guid}/reject")]
    [AuthorizePermission(P.Appointments.Update)]
    public Task<AppointmentDetailDto> Reject(Guid id, CancelAppointmentRequest request, CancellationToken ct) => service.RejectAsync(id, request, ct);

    [HttpPost("{id:guid}/cancel")]
    [AuthorizePermission(P.Appointments.Cancel)]
    public Task<AppointmentDetailDto> Cancel(Guid id, CancelAppointmentRequest request, CancellationToken ct) => service.CancelAsync(id, request, ct);

    [HttpPost("{id:guid}/check-in")]
    [AuthorizePermission(P.Appointments.Update)]
    public Task<AppointmentDetailDto> CheckIn(Guid id, CancellationToken ct) => service.CheckInAsync(id, ct);

    [HttpPost("{id:guid}/no-show")]
    [AuthorizePermission(P.Appointments.Update)]
    public Task<AppointmentDetailDto> NoShow(Guid id, CancellationToken ct) => service.NoShowAsync(id, ct);

    [HttpGet("{id:guid}/checkout")]
    [AuthorizePermission(P.Invoices.Create)]
    public Task<CheckoutPreviewDto> CheckoutPreview(Guid id, CancellationToken ct) => service.GetCheckoutPreviewAsync(id, ct);
}

/// <summary>Trang đặt lịch, tra cứu, tự hủy công khai (07 §4.5).</summary>
[Route("api/public/booking")]
[AllowAnonymous]
public sealed class PublicBookingController(IPublicBookingService service, ICurrentUserService currentUser) : BookingControllerBase
{
    [HttpGet("catalog")]
    public Task<PublicCatalogDto> GetCatalog(CancellationToken ct) => service.GetCatalogAsync(ct);

    [HttpGet("slots")]
    public Task<PublicSlotsDto> GetSlots([FromQuery] PublicSlotsQuery query, CancellationToken ct) => service.GetSlotsAsync(query, ct);

    [HttpPost]
    public async Task<IActionResult> Book(PublicBookingRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.BookAsync(request, ct));

    [HttpPost("lookup")]
    public Task<PublicAppointmentDto> Lookup(PublicLookupRequest request, CancellationToken ct) =>
        service.LookupAsync(request, currentUser.IpAddress, ct);

    [HttpPost("cancel")]
    public Task<PublicAppointmentDto> Cancel(PublicCancelRequest request, CancellationToken ct) =>
        service.CancelAsync(request, currentUser.IpAddress, ct);
}

/// <summary>Thanh toán, bán gói, hóa đơn (07 §4.6).</summary>
[Route("api/invoices")]
public sealed class InvoicesController(IInvoiceService service) : BookingControllerBase
{
    [HttpPost("checkout")]
    [AuthorizePermission(P.Invoices.Create)]
    public async Task<IActionResult> Checkout(CheckoutRequest request, CancellationToken ct) => CreatedOrOk(await service.CheckoutAsync(request, ct));

    [HttpPost("package-sale")]
    [AuthorizePermission(P.CustomerPackages.Sell)]
    public async Task<IActionResult> SellPackage(PackageSaleRequest request, CancellationToken ct) => CreatedOrOk(await service.SellPackageAsync(request, ct));

    [HttpGet]
    [AuthorizePermission(P.Invoices.Create, P.Customers.View)]
    public Task<PaginatedResult<InvoiceDto>> GetPaged([FromQuery] InvoiceQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Invoices.Create, P.Customers.View, P.CustomerPackages.View)]
    public Task<InvoiceDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost("{id:guid}/cancel")]
    [AuthorizePermission(P.Invoices.Cancel)]
    public Task<InvoiceDto> Cancel(Guid id, CancelInvoiceRequest request, CancellationToken ct) => service.CancelAsync(id, request, ct);
}

/// <summary>Gói của khách (07 §4.7).</summary>
[Route("api/customer-packages")]
public sealed class CustomerPackagesController(ICustomerPackageService service) : BookingControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.CustomerPackages.View)]
    public Task<PaginatedResult<CustomerPackageDto>> GetPaged([FromQuery] CustomerPackageQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.CustomerPackages.View)]
    public Task<CustomerPackageDetailDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost("{id:guid}/extend")]
    [AuthorizePermission(P.CustomerPackages.Extend)]
    public Task<CustomerPackageDetailDto> Extend(Guid id, ExtendPackageRequest request, CancellationToken ct) => service.ExtendAsync(id, request, ct);
}

/// <summary>Tổng quan hôm nay (07 §4.10).</summary>
[Route("api/dashboard")]
public sealed class DashboardController(IDashboardService service) : BookingControllerBase
{
    [HttpGet("today")]
    [AuthorizePermission(Application.Constants.Permissions.Dashboard.View)]
    public Task<DashboardTodayDto> Today(CancellationToken ct) => service.GetTodayAsync(ct);
}

/// <summary>Báo cáo (07 §4.10).</summary>
[Route("api/reports")]
public sealed class ReportsController(IReportService service) : BookingControllerBase
{
    [HttpGet("revenue")]
    [AuthorizePermission(P.Reports.View)]
    public Task<RevenueReportDto> Revenue([FromQuery] ReportRangeQuery query, CancellationToken ct) => service.GetRevenueAsync(query, ct);

    [HttpGet("services")]
    [AuthorizePermission(P.Reports.View)]
    public Task<ServiceReportDto> Services([FromQuery] ReportRangeQuery query, CancellationToken ct) => service.GetServicesAsync(query, ct);

    [HttpGet("technicians")]
    [AuthorizePermission(P.Reports.View)]
    public Task<TechnicianReportDto> Technicians([FromQuery] ReportRangeQuery query, CancellationToken ct) => service.GetTechniciansAsync(query, ct);

    [HttpGet("packages")]
    [AuthorizePermission(P.Reports.View)]
    public Task<PackageReportDto> Packages([FromQuery] ReportRangeQuery query, CancellationToken ct) => service.GetPackagesAsync(query, ct);

    [HttpGet("cancellations")]
    [AuthorizePermission(P.Reports.View)]
    public Task<CancellationReportDto> Cancellations([FromQuery] ReportRangeQuery query, CancellationToken ct) => service.GetCancellationsAsync(query, ct);
}
