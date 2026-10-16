using Application.Common.Exceptions;
using Application.Common.Models;
using Application.DTOs.Crm;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Interfaces.Services.Crm;
using Application.Validators.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Crm.Customers;
using Domain.Enums.Booking;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Booking;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Crm;

/// <summary>Hồ sơ khách (UC-13; FR-34, FR-35, BR-13, BR-28).</summary>
public sealed class CustomerService(
    IGenericRepository<Customer> customers,
    IGenericRepository<Appointment> appointments,
    IGenericRepository<Invoice> invoices,
    IGenericRepository<CustomerPackage> packages,
    IBookingContext context,
    IUnitOfWork unitOfWork) : ICustomerService
{
    public async Task<PaginatedResult<CustomerDto>> GetPagedAsync(CustomerQuery query, CancellationToken ct = default)
    {
        var source = customers.QueryNoTracking();
        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var digits = BookingValidationRules.Digits(term);
            var pattern = LikePattern.Contains(term);
            var phonePattern = LikePattern.Contains(digits.Length > 0 ? digits : term);
            source = source.Where(c => AppDbFunctions.Matches(c.FullName, pattern) || AppDbFunctions.Matches(c.Code, pattern)
                                       || AppDbFunctions.Matches(c.Phone, phonePattern));
        }

        var since = context.Today.AddDays(-BookingRules.NoShowWindowDays);
        if (query.Flagged is true)
        {
            source = source.Where(c => appointments.QueryNoTracking()
                .Count(a => a.CustomerId == c.Id && a.Status == AppointmentStatus.KhongDen && a.Date >= since) >= BookingRules.NoShowFlagThreshold);
        }

        if (query.HasActivePackage is true)
            source = source.Where(c => packages.QueryNoTracking().Any(p => p.CustomerId == c.Id && p.Status == CustomerPackageStatus.DangDung));

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var stats = await CustomerStats.LoadAsync(appointments, invoices, packages, page.Items.Select(c => c.Id).ToList(), context.Today, ct);
        return page.Map(items => items.Select(c => CustomerStats.ToDto(c, stats.GetValueOrDefault(c.Id))).ToList());
    }

    public async Task<CustomerLookupDto> LookupAsync(string? phone, CancellationToken ct = default)
    {
        var digits = BookingValidationRules.Digits(phone ?? string.Empty);
        var customer = digits.Length == 0 ? null : await customers.QueryNoTracking().FirstOrDefaultAsync(c => c.Phone == digits, ct);
        if (customer is null)
            return new CustomerLookupDto();
        var dto = await context.GetCustomerDtoAsync(customer.Id, ct);
        var list = await context.GetCustomerPackagesAsync(customer.Id, null, ct);
        return new CustomerLookupDto
        {
            Customer = dto,
            Packages = list.Where(p => p.Status == CustomerPackageStatus.DangDung || p.Status == CustomerPackageStatus.HetHan).ToList()
        };
    }

    public Task<CustomerDto> GetAsync(Guid id, CancellationToken ct = default) => context.GetCustomerDtoAsync(id, ct);

    public async Task<CustomerDto> CreateAsync(SaveCustomerRequest request, CancellationToken ct = default)
    {
        var phone = BookingValidationRules.Digits(request.Phone!);
        if (await customers.AnyAsync(c => c.Phone == phone, ct))
            throw new ConflictException($"Số điện thoại {phone} đã có hồ sơ khách.", "phone");
        var customer = new Customer { Phone = phone, Code = await NextCodeAsync(customers, ct) };
        Apply(customer, request);
        await customers.AddAsync(customer, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await context.GetCustomerDtoAsync(customer.Id, ct);
    }

    public async Task<CustomerDto> UpdateAsync(Guid id, SaveCustomerRequest request, CancellationToken ct = default)
    {
        var customer = await customers.GetByIdAsync(id, ct) ?? throw new NotFoundException("Không tìm thấy khách.");
        var phone = BookingValidationRules.Digits(request.Phone!);
        if (await customers.AnyAsync(c => c.Phone == phone && c.Id != id, ct))
            throw new ConflictException($"Số điện thoại {phone} đã có hồ sơ khách.", "phone");
        customer.Phone = phone;
        Apply(customer, request);
        await unitOfWork.SaveChangesAsync(ct);
        return await context.GetCustomerDtoAsync(id, ct);
    }

    /// <summary>KH + 5 số, số lớn nhất + 1 (06 §3).</summary>
    public static async Task<string> NextCodeAsync(IGenericRepository<Customer> customers, CancellationToken ct)
    {
        var codes = await customers.QueryNoTracking().Select(c => c.Code).ToListAsync(ct);
        return BookingQueries.NextCatalogCode(codes, "KH", 5);
    }

    private static void Apply(Customer customer, SaveCustomerRequest request)
    {
        customer.FullName = request.FullName!.Trim();
        customer.BirthDate = request.BirthDate;
        customer.Gender = request.Gender;
        customer.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
    }
}
