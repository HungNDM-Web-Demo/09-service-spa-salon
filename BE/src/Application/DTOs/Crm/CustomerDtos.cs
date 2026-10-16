using Application.Common.Models;
using Application.DTOs.Booking;
using Domain.Enums.Crm;

namespace Application.DTOs.Crm;

// Hồ sơ khách (07 §4.9).

public sealed class CustomerDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public DateOnly? BirthDate { get; init; }
    public Gender? Gender { get; init; }
    public string? Note { get; init; }
    public DateTime CreatedAt { get; init; }
    public int NoShowCount90 { get; init; }
    public bool IsFlagged { get; init; }
    public decimal TotalSpent { get; init; }
    public int VisitCount { get; init; }
    public DateTime? LastVisitAt { get; init; }
    public int ActivePackageCount { get; init; }
}

public sealed class CustomerQuery : PaginationQuery
{
    public bool? Flagged { get; set; }
    public bool? HasActivePackage { get; set; }
}

public sealed class SaveCustomerRequest
{
    public string? Phone { get; set; }
    public string? FullName { get; set; }
    public DateOnly? BirthDate { get; set; }
    public Gender? Gender { get; set; }
    public string? Note { get; set; }
}

public sealed class CustomerLookupDto
{
    public CustomerDto? Customer { get; init; }
    public IReadOnlyList<CustomerPackageBrief> Packages { get; init; } = [];
}

public sealed class PhoneQuery
{
    public string? Phone { get; set; }
}
