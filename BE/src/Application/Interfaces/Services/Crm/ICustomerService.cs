using Application.Common.Models;
using Application.DTOs.Crm;

namespace Application.Interfaces.Services.Crm;

/// <summary>Hồ sơ khách (UC-13; 07 §4.9).</summary>
public interface ICustomerService
{
    Task<PaginatedResult<CustomerDto>> GetPagedAsync(CustomerQuery query, CancellationToken ct = default);
    Task<CustomerLookupDto> LookupAsync(string? phone, CancellationToken ct = default);
    Task<CustomerDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CustomerDto> CreateAsync(SaveCustomerRequest request, CancellationToken ct = default);
    Task<CustomerDto> UpdateAsync(Guid id, SaveCustomerRequest request, CancellationToken ct = default);
}
