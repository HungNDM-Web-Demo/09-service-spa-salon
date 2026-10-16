using Domain.Enums.Booking;

namespace Application.DTOs.Booking;

// Tổng quan hôm nay (FR-01, FR-02) và báo cáo (FR-36 đến FR-38, 07 §3.11).

public sealed class DashboardCardDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public AppointmentStatus Status { get; init; }
    public AppointmentSource Source { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public DateTime StartAt { get; init; }
    public DateTime EndAt { get; init; }
    public string Services { get; init; } = string.Empty;
    public string StaffNames { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public bool PendingOverdue { get; init; }
    public bool IsLate { get; init; }
}

public sealed class DashboardCountsDto
{
    public int Total { get; init; }
    public int Pending { get; init; }
    public int Confirmed { get; init; }
    public int InService { get; init; }
    public int Completed { get; init; }
    public int NoShow { get; init; }
    public int Cancelled { get; init; }
}

public sealed class DashboardTodayDto
{
    public DateOnly Date { get; init; }
    public string? ShopClosedReason { get; init; }
    public DashboardCountsDto Counts { get; init; } = new();
    public decimal RevenueToday { get; init; }
    public int NewCustomersToday { get; init; }
    public IReadOnlyList<DashboardCardDto> Upcoming { get; init; } = [];
    public IReadOnlyList<DashboardCardDto> PendingOnline { get; init; } = [];
    public IReadOnlyList<DashboardCardDto> Tomorrow { get; init; } = [];
}

public sealed class ReportRangeQuery
{
    public string? From { get; set; }
    public string? To { get; set; }
    public Guid? GroupId { get; set; }
}

public sealed class RevenueDayDto
{
    public DateOnly Date { get; init; }
    public decimal ServiceRevenue { get; init; }
    public decimal PackageRevenue { get; init; }
    public decimal Revenue { get; init; }
    public decimal ServiceValue { get; init; }
    public int InvoiceCount { get; init; }
    public decimal Discount { get; init; }
}

public sealed class RevenueTotalsDto
{
    public DateOnly From { get; init; }
    public DateOnly To { get; init; }
    public decimal ServiceRevenue { get; init; }
    public decimal PackageRevenue { get; init; }
    public decimal Revenue { get; init; }
    public decimal ServiceValue { get; init; }
    public int InvoiceCount { get; init; }
    public decimal Discount { get; init; }
}

public sealed class RevenueReportDto
{
    public DateOnly From { get; init; }
    public DateOnly To { get; init; }
    public IReadOnlyList<RevenueDayDto> Days { get; init; } = [];
    public RevenueTotalsDto Totals { get; init; } = new();
    public RevenueTotalsDto Previous { get; init; } = new();
}

public sealed record ServiceReportRow(Guid ServiceId, string Code, string Name, string GroupName, int Count, decimal Value, decimal Share, int PackageCount);

public sealed class ServiceReportDto
{
    public IReadOnlyList<ServiceReportRow> Rows { get; init; } = [];
    public int TotalCount { get; init; }
    public decimal TotalValue { get; init; }
    public int TotalPackageCount { get; init; }
}

public sealed record TechnicianReportRow(
    Guid StaffMemberId,
    string Code,
    string FullName,
    int Count,
    decimal Value,
    int BookedMinutes,
    int ShiftMinutes,
    decimal Occupancy,
    decimal Commission);

public sealed class TechnicianReportDto
{
    public IReadOnlyList<TechnicianReportRow> Rows { get; init; } = [];
}

public sealed record PackageReportRow(Guid PackageTemplateId, string Code, string Name, int SoldCount, decimal SoldAmount, int UsedSessions);

public sealed class PackageReportDto
{
    public int SoldCount { get; init; }
    public decimal SoldAmount { get; init; }
    public int ActiveCount { get; init; }
    public int UnusedSessions { get; init; }
    public decimal UnusedValue { get; init; }
    public IReadOnlyList<PackageReportRow> Rows { get; init; } = [];
    public IReadOnlyList<CustomerPackageDto> ExpiringSoon { get; init; } = [];
}

public sealed record CancellationSourceRow(AppointmentSource Source, int Total, int Cancelled, int NoShow);

public sealed class CancellationReportDto
{
    public int Total { get; init; }
    public int Cancelled { get; init; }
    public int NoShow { get; init; }
    public decimal CancelRate { get; init; }
    public decimal NoShowRate { get; init; }
    public IReadOnlyList<CancellationSourceRow> BySource { get; init; } = [];
}
