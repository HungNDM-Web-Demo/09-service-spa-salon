using Domain.Base;
using Domain.Enums.Hr;

namespace Domain.Entities.Hr.Commissions;

/// <summary>Bảng hoa hồng tháng (06 §4 <c>Hr_CommissionPeriods</c>). <see cref="Month"/> dạng <c>yyyyMM</c>.</summary>
public class CommissionPeriod : BaseEntity, ICreationTracked, IModificationTracked, IAuditLogExempt
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 100;

    public string Code { get; set; } = string.Empty;
    public int Month { get; set; }
    public CommissionPeriodStatus Status { get; set; } = CommissionPeriodStatus.TamTinh;
    public DateTime? ClosedAt { get; set; }
    public string? ClosedByName { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaidByName { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
