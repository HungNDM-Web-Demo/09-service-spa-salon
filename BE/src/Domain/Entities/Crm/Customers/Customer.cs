using Domain.Base;
using Domain.Enums.Crm;

namespace Domain.Entities.Crm.Customers;

/// <summary>
/// Hồ sơ khách (06 §4 <c>Crm_Customers</c>, FR-34). Số lần không đến 90 ngày, nhãn "Hay bỏ hẹn", tổng chi tiêu
/// tính khi đọc, không lưu cột.
/// </summary>
public class Customer : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 10;
    public const int PhoneMaxLength = 10;
    public const int NameMaxLength = 100;
    public const int NoteMaxLength = 500;

    public string Code { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public DateOnly? BirthDate { get; set; }
    public Gender? Gender { get; set; }
    public string? Note { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public void SetCreatedAt(DateTime value) => CreatedAt = value;
}
