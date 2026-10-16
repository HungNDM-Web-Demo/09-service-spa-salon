using Application.Common.Models;
using Application.DTOs.Booking;

namespace Application.Interfaces.Services.Booking;

/// <summary>Nhóm dịch vụ, dịch vụ (UC-01, 07 §4.1).</summary>
public interface IServiceCatalogService
{
    Task<IReadOnlyList<ServiceGroupDto>> GetGroupsAsync(CancellationToken ct = default);
    Task<ServiceGroupDto> CreateGroupAsync(SaveServiceGroupRequest request, CancellationToken ct = default);
    Task<ServiceGroupDto> UpdateGroupAsync(Guid id, SaveServiceGroupRequest request, CancellationToken ct = default);
    Task ReorderGroupsAsync(ReorderRequest request, CancellationToken ct = default);
    Task DeleteGroupAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<ServiceDto>> GetServicesAsync(Guid? groupId, bool? visible, CancellationToken ct = default);
    Task<IReadOnlyList<ServiceOption>> GetOptionsAsync(CancellationToken ct = default);
    Task<NextCodeDto> NextCodeAsync(CancellationToken ct = default);
    Task<ServiceDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<ServiceDto> CreateAsync(SaveServiceRequest request, CancellationToken ct = default);
    Task<ServiceDto> UpdateAsync(Guid id, SaveServiceRequest request, CancellationToken ct = default);
    Task<ServiceDto> SetVisibilityAsync(Guid id, bool isVisible, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Gói mẫu (UC-01 1b, 07 §4.2).</summary>
public interface IPackageTemplateService
{
    Task<IReadOnlyList<PackageTemplateDto>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PackageTemplateDto>> GetOptionsAsync(CancellationToken ct = default);
    Task<NextCodeDto> NextCodeAsync(CancellationToken ct = default);
    Task<PackageTemplateDto> CreateAsync(SavePackageTemplateRequest request, CancellationToken ct = default);
    Task<PackageTemplateDto> UpdateAsync(Guid id, SavePackageTemplateRequest request, CancellationToken ct = default);
    Task<PackageTemplateDto> SetActiveAsync(Guid id, bool isActive, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Giờ mở cửa (FR-07).</summary>
public interface IBusinessHoursService
{
    Task<BusinessHoursDto> GetAsync(CancellationToken ct = default);
    Task<BusinessHoursDto> UpdateAsync(UpdateBusinessHoursRequest request, CancellationToken ct = default);
    Task<StoreProfileDto> GetStoreProfileAsync(CancellationToken ct = default);
}

/// <summary>Lịch hẹn tại quầy, lưới, xác nhận, đổi giờ, hủy, check-in, không đến (UC-03, UC-05, UC-07; 07 §4.4).</summary>
public interface IAppointmentService
{
    Task<BoardDto> GetBoardAsync(string? date, CancellationToken ct = default);
    Task<PaginatedResult<AppointmentListItem>> GetPagedAsync(AppointmentQuery query, CancellationToken ct = default);
    Task<AppointmentDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CheckResultDto> CheckAsync(CheckAppointmentRequest request, CancellationToken ct = default);
    Task<SuggestionsDto> SuggestAsync(SuggestionQuery query, CancellationToken ct = default);
    Task<AppointmentDetailDto> CreateAsync(CreateAppointmentRequest request, CancellationToken ct = default);
    Task<AppointmentDetailDto> UpdateAsync(Guid id, UpdateAppointmentRequest request, CancellationToken ct = default);
    Task<AppointmentDetailDto> MoveLineAsync(Guid id, Guid lineId, MoveLineRequest request, CancellationToken ct = default);
    Task<AppointmentDetailDto> ConfirmAsync(Guid id, CancellationToken ct = default);
    Task<AppointmentDetailDto> RejectAsync(Guid id, CancelAppointmentRequest request, CancellationToken ct = default);
    Task<AppointmentDetailDto> CancelAsync(Guid id, CancelAppointmentRequest request, CancellationToken ct = default);
    Task<AppointmentDetailDto> CheckInAsync(Guid id, CancellationToken ct = default);
    Task<AppointmentDetailDto> NoShowAsync(Guid id, CancellationToken ct = default);
    Task<CheckoutPreviewDto> GetCheckoutPreviewAsync(Guid id, CancellationToken ct = default);
}

/// <summary>Trang đặt lịch, tra cứu, tự hủy công khai (UC-04, UC-06; 07 §4.5).</summary>
public interface IPublicBookingService
{
    Task<PublicCatalogDto> GetCatalogAsync(CancellationToken ct = default);
    Task<PublicSlotsDto> GetSlotsAsync(PublicSlotsQuery query, CancellationToken ct = default);
    Task<PublicAppointmentDto> BookAsync(PublicBookingRequest request, CancellationToken ct = default);
    Task<PublicAppointmentDto> LookupAsync(PublicLookupRequest request, string? clientKey, CancellationToken ct = default);
    Task<PublicAppointmentDto> CancelAsync(PublicCancelRequest request, string? clientKey, CancellationToken ct = default);
}

/// <summary>Thanh toán, bán gói, hủy hóa đơn (UC-08, UC-09, UC-10; 07 §4.6).</summary>
public interface IInvoiceService
{
    Task<CreateResult<InvoiceDto>> CheckoutAsync(CheckoutRequest request, CancellationToken ct = default);
    Task<CreateResult<InvoiceDto>> SellPackageAsync(PackageSaleRequest request, CancellationToken ct = default);
    Task<InvoiceDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<PaginatedResult<InvoiceDto>> GetPagedAsync(InvoiceQuery query, CancellationToken ct = default);
    Task<InvoiceDto> CancelAsync(Guid id, CancelInvoiceRequest request, CancellationToken ct = default);
}

/// <summary>Gói của khách (FR-28, FR-29; 07 §4.7).</summary>
public interface ICustomerPackageService
{
    Task<PaginatedResult<CustomerPackageDto>> GetPagedAsync(CustomerPackageQuery query, CancellationToken ct = default);
    Task<CustomerPackageDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CustomerPackageDetailDto> ExtendAsync(Guid id, ExtendPackageRequest request, CancellationToken ct = default);
}

/// <summary>Tổng quan hôm nay (UC-14).</summary>
public interface IDashboardService
{
    Task<DashboardTodayDto> GetTodayAsync(CancellationToken ct = default);
}

/// <summary>Báo cáo (UC-15, 07 §3.11).</summary>
public interface IReportService
{
    Task<RevenueReportDto> GetRevenueAsync(ReportRangeQuery query, CancellationToken ct = default);
    Task<ServiceReportDto> GetServicesAsync(ReportRangeQuery query, CancellationToken ct = default);
    Task<TechnicianReportDto> GetTechniciansAsync(ReportRangeQuery query, CancellationToken ct = default);
    Task<PackageReportDto> GetPackagesAsync(ReportRangeQuery query, CancellationToken ct = default);
    Task<CancellationReportDto> GetCancellationsAsync(ReportRangeQuery query, CancellationToken ct = default);
}

/// <summary>Việc nền (06 §3): không đến sau ngày hẹn, gói hết hạn, tin nhắc.</summary>
public interface IBookingMaintenanceService
{
    Task<int> RunAsync(CancellationToken ct = default);
}
