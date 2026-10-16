using Domain.Base;
using Domain.Enums.Hr;

namespace Domain.Entities.Hr.StaffMembers;

/// <summary>
/// Nhân viên (06 §4 <c>Hr_StaffMembers</c>): kỹ thuật viên hoặc lễ tân. KTV có dịch vụ làm được (<see cref="Services"/>)
/// và đủ 7 dòng ca tuần (<see cref="Shifts"/>, Thứ Hai = 1 … Chủ nhật = 7).
/// </summary>
public class StaffMember : BaseEntity, ICreationTracked, IModificationTracked
{
    public const int CodeMaxLength = 10;
    public const int NameMaxLength = 100;
    public const int PhoneMaxLength = 10;
    public const int ColorMaxLength = 7;
    public const int SpecialtyMaxLength = 150;

    public string Code { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public StaffKind Kind { get; set; }
    public string Color { get; set; } = "#64748B";
    public string? Specialty { get; set; }
    public Guid? UserId { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? UpdatedBy { get; set; }

    public List<StaffService> Services { get; set; } = [];
    public List<WeeklyShift> Shifts { get; set; } = [];

    public bool IsTechnician => Kind == StaffKind.KyThuatVien;

    /// <summary>Ca của thứ <paramref name="isoDayOfWeek"/> (1 = Thứ Hai); lễ tân, thiếu dòng coi là nghỉ.</summary>
    public ShiftType ShiftOn(int isoDayOfWeek) =>
        Shifts.FirstOrDefault(s => s.DayOfWeek == isoDayOfWeek)?.Shift ?? ShiftType.Nghi;

    public bool CanDo(Guid serviceId) => Services.Any(s => s.ServiceId == serviceId);
}

/// <summary>Dịch vụ KTV làm được (06 §4 <c>Hr_StaffServices</c>; bảng nối, khóa ghép).</summary>
public class StaffService
{
    public Guid StaffMemberId { get; set; }
    public Guid ServiceId { get; set; }
}

/// <summary>Ca làm theo thứ (06 §4 <c>Hr_WeeklyShifts</c>; khóa ghép <c>(StaffMemberId, DayOfWeek)</c>).</summary>
public class WeeklyShift
{
    public Guid StaffMemberId { get; set; }
    public int DayOfWeek { get; set; }
    public ShiftType Shift { get; set; }
}
