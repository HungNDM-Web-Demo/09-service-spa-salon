using Domain.Base;

namespace Domain.Entities.Hr.DaysOff;

/// <summary>Ngày nghỉ đột xuất của KTV, hoặc ngày cả tiệm nghỉ khi <see cref="StaffMemberId"/> null (06 §4 <c>Hr_DaysOff</c>).</summary>
public class DayOff : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int ReasonMaxLength = 200;

    public Guid? StaffMemberId { get; set; }
    public DateOnly Date { get; set; }
    public string Reason { get; set; } = string.Empty;

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }
}
