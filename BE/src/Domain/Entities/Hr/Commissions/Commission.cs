using Domain.Base;
using Domain.Enums.Booking;
using Domain.Enums.Hr;

namespace Domain.Entities.Hr.Commissions;

/// <summary>Một khoản hoa hồng (06 §4 <c>Hr_Commissions</c>). Hủy hóa đơn xóa cứng các khoản của hóa đơn (BR-26).</summary>
public class Commission : BaseEntity, ICreationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 20;
    public const int NameMaxLength = 100;
    public const int DescriptionMaxLength = 200;

    public Guid StaffMemberId { get; set; }
    public CommissionKind Kind { get; set; }
    public Guid InvoiceId { get; set; }
    public Guid InvoiceLineId { get; set; }
    public Guid? AppointmentId { get; set; }
    public string InvoiceCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int Month { get; set; }
    public DateTime EarnedAt { get; set; }
    public decimal BaseAmount { get; set; }
    public CommissionType RateType { get; set; }
    public decimal RateValue { get; set; }
    public decimal Amount { get; set; }

    public Guid? CreatedBy { get; set; }
}
