using Application.Common.Models;
using Domain.Enums.Booking;

namespace Application.DTOs.Booking;

// Thanh toán, hóa đơn, gói của khách (07 §4.4 checkout, §4.6, §4.7).

public sealed record CustomerRef(Guid Id, string Code, string FullName, string Phone);

public sealed class CheckoutPreviewLine
{
    public Guid AppointmentLineId { get; init; }
    public Guid ServiceId { get; init; }
    public string ServiceName { get; init; } = string.Empty;
    public Guid StaffMemberId { get; init; }
    public string StaffName { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public int DurationMinutes { get; init; }
    public CommissionType CommissionType { get; init; }
    public decimal CommissionValue { get; init; }
}

public sealed class CheckoutPreviewDto
{
    public Guid AppointmentId { get; init; }
    public string AppointmentCode { get; init; } = string.Empty;
    public AppointmentStatus Status { get; init; }
    public CustomerRef Customer { get; init; } = new(Guid.Empty, string.Empty, string.Empty, string.Empty);
    public IReadOnlyList<CheckoutPreviewLine> Lines { get; init; } = [];
    public IReadOnlyList<CustomerPackageBrief> Packages { get; init; } = [];
    public int DiscountLimitPercent { get; init; }
    public DateOnly Today { get; init; }
}

public sealed class CheckoutLineChoice
{
    public Guid AppointmentLineId { get; set; }
    public bool UsePackage { get; set; }
}

public sealed class SellPackageChoice
{
    public Guid PackageTemplateId { get; set; }
    public Guid ConsultantStaffId { get; set; }
}

public sealed class DiscountRequest
{
    public DiscountType Type { get; set; }
    public decimal Value { get; set; }
    public string? Reason { get; set; }
}

public sealed class CheckoutRequest
{
    public string? ClientRequestId { get; set; }
    public Guid AppointmentId { get; set; }
    public List<CheckoutLineChoice> Lines { get; set; } = [];
    public List<SellPackageChoice> SellPackages { get; set; } = [];
    public DiscountRequest? Discount { get; set; }
    public string? IntervalOverrideReason { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal? CashReceived { get; set; }
    public string? CardAuthCode { get; set; }
    public decimal ExpectedTotal { get; set; }
}

public sealed class PackageSaleRequest
{
    public string? ClientRequestId { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid PackageTemplateId { get; set; }
    public Guid? ConsultantStaffId { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal? CashReceived { get; set; }
    public string? CardAuthCode { get; set; }
    public decimal ExpectedTotal { get; set; }
}

public sealed class InvoiceLineDto
{
    public Guid Id { get; init; }
    public InvoiceLineKind Kind { get; init; }
    public string Description { get; init; } = string.Empty;
    public string StaffName { get; init; } = string.Empty;
    public int DurationMinutes { get; init; }
    public decimal ListPrice { get; init; }
    public bool UsesPackage { get; init; }
    public decimal Amount { get; init; }
    public decimal BasePrice { get; init; }
    public string? PackageCode { get; init; }
    public int? PackageRemaining { get; init; }
    public DateOnly? PackageExpiryDate { get; init; }
    public decimal CommissionAmount { get; init; }
}

public sealed class InvoiceDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public Guid? AppointmentId { get; init; }
    public string? AppointmentCode { get; init; }
    public CustomerRef Customer { get; init; } = new(Guid.Empty, string.Empty, string.Empty, string.Empty);
    public DateTime PaidAt { get; init; }
    public string CashierName { get; init; } = string.Empty;
    public decimal ServiceTotal { get; init; }
    public decimal PackageTotal { get; init; }
    public DiscountType? DiscountType { get; init; }
    public decimal DiscountValue { get; init; }
    public decimal DiscountAmount { get; init; }
    public string? DiscountReason { get; init; }
    public decimal Total { get; init; }
    public PaymentMethod Method { get; init; }
    public decimal? CashReceived { get; init; }
    public decimal? ChangeAmount { get; init; }
    public string? CardAuthCode { get; init; }
    public string? IntervalOverrideReason { get; init; }
    public InvoiceStatus Status { get; init; }
    public string? CancelReason { get; init; }
    public DateTime? CancelledAt { get; init; }
    public string? CancelledByName { get; init; }
    public bool CanCancel { get; init; }
    public string? CancelBlockedReason { get; init; }
    public IReadOnlyList<InvoiceLineDto> Lines { get; init; } = [];
}

/// <summary>Kết quả tạo hóa đơn: <see cref="Created"/> false khi gửi lại cùng <c>clientRequestId</c> (trả 200).</summary>
public sealed record CreateResult<T>(T Value, bool Created);

public sealed class InvoiceQuery : PaginationQuery
{
    public Guid? CustomerId { get; set; }
    public string? From { get; set; }
    public string? To { get; set; }
}

public sealed class CancelInvoiceRequest
{
    public string? Reason { get; set; }
}

public class CustomerPackageDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string PackageName { get; init; } = string.Empty;
    public Guid ServiceId { get; init; }
    public string ServiceName { get; init; } = string.Empty;
    public int TotalSessions { get; init; }
    public int UsedSessions { get; init; }
    public int Remaining { get; init; }
    public DateOnly ExpiryDate { get; init; }
    public CustomerPackageStatus Status { get; init; }
    public decimal SessionValue { get; init; }
    public int MinIntervalDays { get; init; }
    public DateTime? LastUsedAt { get; init; }
    public DateTime PurchasedAt { get; init; }
    public Guid CustomerId { get; init; }
    public string CustomerCode { get; init; } = string.Empty;
    public string CustomerName { get; init; } = string.Empty;
    public string CustomerPhone { get; init; } = string.Empty;
    public Guid PackageTemplateId { get; init; }
    public decimal Price { get; init; }
    public int? ExtendedDays { get; init; }
    public string? ExtendReason { get; init; }
    public string ConsultantName { get; init; } = string.Empty;
    public Guid InvoiceId { get; init; }
    public string InvoiceCode { get; init; } = string.Empty;
    public bool ExpiringSoon { get; init; }
    public bool CanExtend { get; init; }
}

public sealed record PackageUsageDto(
    Guid Id,
    DateTime UsedAt,
    Guid? AppointmentId,
    string? AppointmentCode,
    string InvoiceCode,
    string StaffName,
    string? OverrideReason,
    bool Refunded);

public sealed class CustomerPackageDetailDto : CustomerPackageDto
{
    public IReadOnlyList<PackageUsageDto> Usages { get; init; } = [];
}

public sealed class CustomerPackageQuery : PaginationQuery
{
    public CustomerPackageStatus? Status { get; set; }

    /// <summary><c>expiringSoon</c> (hết hạn trong 30 ngày) hoặc <c>lastSession</c> (còn 1 buổi).</summary>
    public string? Filter { get; set; }

    public Guid? CustomerId { get; set; }
}

public sealed class ExtendPackageRequest
{
    public int Days { get; set; }
    public string? Reason { get; set; }
}
