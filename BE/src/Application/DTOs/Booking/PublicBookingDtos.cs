using Domain.Enums.Booking;

namespace Application.DTOs.Booking;

// Trang đặt lịch, tra cứu công khai (07 §4.5).

public sealed record PublicShopDto(string Name, string Address, string Hotline, string? LogoUrl);

public sealed record PublicServiceDto(Guid Id, string Code, string Name, string? Description, string? ImageUrl, int DurationMinutes, decimal Price);

public sealed record PublicGroupDto(Guid Id, string Name, IReadOnlyList<PublicServiceDto> Services);

public sealed record PublicTechnicianDto(Guid Id, string FullName, string? Specialty, string Color, IReadOnlyList<Guid> ServiceIds);

public sealed class PublicCatalogDto
{
    public PublicShopDto Shop { get; init; } = new(string.Empty, string.Empty, string.Empty, null);
    public string OpenTime { get; init; } = "09:00";
    public string CloseTime { get; init; } = "21:00";
    public IReadOnlyList<PublicGroupDto> Groups { get; init; } = [];
    public IReadOnlyList<PublicTechnicianDto> Technicians { get; init; } = [];
}

public sealed class PublicSlotsQuery
{
    /// <summary>Id dịch vụ, cách nhau bởi dấu phẩy, theo thứ tự khách chọn.</summary>
    public string? ServiceIds { get; set; }

    /// <summary>Trống = "Bất kỳ ai".</summary>
    public Guid? StaffMemberId { get; set; }

    public string? Date { get; set; }
}

public sealed class PublicSlotsDto
{
    public DateOnly Date { get; init; }
    public IReadOnlyList<string> Slots { get; init; } = [];
    public DateOnly? NextAvailableDate { get; init; }
    public string? ClosedReason { get; init; }
}

public sealed class PublicBookingRequest
{
    public List<Guid> ServiceIds { get; set; } = [];
    public Guid? StaffMemberId { get; set; }
    public DateTime StartAt { get; set; }
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string? Note { get; set; }
}

public sealed record PublicLineDto(string ServiceName, string StaffName, DateTime StartAt, DateTime EndAt, decimal Price);

public sealed class PublicAppointmentDto
{
    public string Code { get; init; } = string.Empty;
    public AppointmentStatus Status { get; init; }
    public DateOnly Date { get; init; }
    public DateTime StartAt { get; init; }
    public DateTime EndAt { get; init; }
    public decimal Total { get; init; }
    public string PhoneMasked { get; init; } = string.Empty;
    public string CustomerName { get; init; } = string.Empty;
    public bool CanCancel { get; init; }
    public string Hotline { get; init; } = string.Empty;
    public IReadOnlyList<PublicLineDto> Lines { get; init; } = [];
}

public sealed class PublicLookupRequest
{
    public string? Code { get; set; }
    public string? Phone { get; set; }
}

public sealed class PublicCancelRequest
{
    public string? Code { get; set; }
    public string? Phone { get; set; }
    public string? Reason { get; set; }
}
