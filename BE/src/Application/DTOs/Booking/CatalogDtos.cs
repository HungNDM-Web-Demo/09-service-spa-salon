using Domain.Enums.Booking;

namespace Application.DTOs.Booking;

// Nhóm dịch vụ, dịch vụ, gói mẫu, giờ mở cửa (07 §4.1, §4.2, §4.3).

public sealed class ServiceGroupDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool IsVisible { get; init; }
    public int ServiceCount { get; init; }
}

public sealed class SaveServiceGroupRequest
{
    public string? Name { get; set; }
    public bool IsVisible { get; set; } = true;
}

public sealed class ReorderRequest
{
    public List<Guid> Ids { get; set; } = [];
}

public sealed class ServiceDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid GroupId { get; init; }
    public string GroupName { get; init; } = string.Empty;
    public int DurationMinutes { get; init; }
    public int CleanupMinutes { get; init; }
    public decimal Price { get; init; }
    public string? Description { get; init; }
    public string? ImageUrl { get; init; }
    public bool AllowOnline { get; init; }
    public CommissionType CommissionType { get; init; }
    public decimal CommissionValue { get; init; }
    public bool IsVisible { get; init; }
    public int TechnicianCount { get; init; }

    /// <summary>UC-01 E4: bật đặt online nhưng chưa hiện trên trang đặt lịch, kèm lý do.</summary>
    public string? OnlineWarning { get; init; }

    public DateTime CreatedAt { get; init; }
}

public sealed class SaveServiceRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public Guid GroupId { get; set; }
    public int DurationMinutes { get; set; }
    public int CleanupMinutes { get; set; } = 10;
    public decimal Price { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool AllowOnline { get; set; }
    public CommissionType CommissionType { get; set; }
    public decimal CommissionValue { get; set; }
    public bool IsVisible { get; set; } = true;
}

public sealed class SetVisibilityRequest
{
    public bool IsVisible { get; set; }
}

public sealed class SetActiveRequest
{
    public bool IsActive { get; set; }
}

public sealed record ServiceOption(
    Guid Id,
    string Code,
    string Name,
    Guid GroupId,
    string GroupName,
    int DurationMinutes,
    int CleanupMinutes,
    decimal Price,
    IReadOnlyList<Guid> TechnicianIds);

public sealed record NextCodeDto(string Code);

public sealed class PackageTemplateDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public Guid ServiceId { get; init; }
    public string ServiceCode { get; init; } = string.Empty;
    public string ServiceName { get; init; } = string.Empty;
    public decimal ServicePrice { get; init; }
    public int Sessions { get; init; }
    public decimal Price { get; init; }
    public int ValidityMonths { get; init; }
    public int MinIntervalDays { get; init; }
    public decimal CommissionRate { get; init; }
    public bool IsActive { get; init; }
    public decimal RetailEquivalent { get; init; }
    public decimal SavingAmount { get; init; }
    public decimal SavingPercent { get; init; }
    public decimal SessionValue { get; init; }
    public int SoldCount { get; init; }
}

public sealed class SavePackageTemplateRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public Guid ServiceId { get; set; }
    public int Sessions { get; set; }
    public decimal Price { get; set; }
    public int ValidityMonths { get; set; }
    public int MinIntervalDays { get; set; }
    public decimal CommissionRate { get; set; } = 5;
    public bool IsActive { get; set; } = true;
}

public sealed class BusinessHoursDto
{
    public string OpenTime { get; init; } = "09:00";
    public string CloseTime { get; init; } = "21:00";
}

/// <summary>Thông tin tiệm in trên hóa đơn và mã QR chuyển khoản (Store.*), người đăng nhập nào cũng đọc được.</summary>
public sealed record StoreProfileDto(
    string Name,
    string Address,
    string Hotline,
    string? LogoUrl,
    string BankBin,
    string BankAccount,
    string BankAccountName);

public sealed class UpdateBusinessHoursRequest
{
    public string? OpenTime { get; set; }
    public string? CloseTime { get; set; }
}

/// <summary>Lịch bị ảnh hưởng khi đổi ca, thêm ngày nghỉ, bỏ dịch vụ… (BR-27, 409 <c>LichBiAnhHuong</c>).</summary>
public sealed record AffectedAppointment(
    Guid AppointmentId,
    string Code,
    DateOnly Date,
    DateTime StartAt,
    DateTime EndAt,
    string CustomerName,
    string ServiceName,
    string StaffName,
    AppointmentStatus Status);
