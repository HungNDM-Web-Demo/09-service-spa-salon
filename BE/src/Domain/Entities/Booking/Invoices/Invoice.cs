using Domain.Base;
using Domain.Entities.Crm.Customers;
using Domain.Enums.Booking;

namespace Domain.Entities.Booking.Invoices;

/// <summary>Hóa đơn (06 §4 <c>Booking_Invoices</c>): thanh toán lịch hẹn hoặc bán gói riêng (<see cref="AppointmentId"/> null).</summary>
public class Invoice : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 100;
    public const int ReasonMaxLength = 200;
    public const int DiscountReasonMaxLength = 100;
    public const int ClientRequestIdMaxLength = 64;

    public string Code { get; set; } = string.Empty;
    public Guid? AppointmentId { get; set; }
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public DateTime PaidAt { get; set; }
    public string CashierName { get; set; } = string.Empty;
    public decimal ServiceTotal { get; set; }
    public decimal PackageTotal { get; set; }
    public DiscountType? DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? DiscountReason { get; set; }
    public decimal Total { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal? CashReceived { get; set; }
    public decimal? ChangeAmount { get; set; }
    public string? CardAuthCode { get; set; }
    public string? IntervalOverrideReason { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.DaThanhToan;
    public string? CancelReason { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelledByName { get; set; }
    public string? ClientRequestId { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<InvoiceLine> Lines { get; set; } = [];

    public void SetCreatedAt(DateTime value) => CreatedAt = value;
}
