using API.Controllers.Booking;
using API.Filters;
using Application.Common.Models;
using Application.DTOs.Crm;
using Application.Interfaces.Services.Crm;
using Microsoft.AspNetCore.Mvc;
using P = Application.Constants.ProjectPermissions;

namespace API.Controllers.Crm;

/// <summary>Hồ sơ khách (07 §4.9).</summary>
[Route("api/customers")]
public sealed class CustomersController(ICustomerService service) : BookingControllerBase
{
    [HttpGet]
    [AuthorizePermission(P.Customers.View)]
    public Task<PaginatedResult<CustomerDto>> GetPaged([FromQuery] CustomerQuery query, CancellationToken ct) => service.GetPagedAsync(query, ct);

    [HttpGet("lookup")]
    [AuthorizePermission(P.Customers.View, P.Appointments.Create, P.CustomerPackages.Sell)]
    public Task<CustomerLookupDto> Lookup([FromQuery] PhoneQuery query, CancellationToken ct) => service.LookupAsync(query.Phone, ct);

    [HttpGet("{id:guid}")]
    [AuthorizePermission(P.Customers.View)]
    public Task<CustomerDto> Get(Guid id, CancellationToken ct) => service.GetAsync(id, ct);

    [HttpPost]
    [AuthorizePermission(P.Customers.Create)]
    public async Task<IActionResult> Create(SaveCustomerRequest request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    [AuthorizePermission(P.Customers.Update)]
    public Task<CustomerDto> Update(Guid id, SaveCustomerRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);
}
