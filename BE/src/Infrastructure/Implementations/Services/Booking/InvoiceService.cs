using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.Constants;
using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.PackageTemplates;
using Domain.Entities.Booking.Services;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.Commissions;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using FluentValidation;
using FluentValidation.Results;
using Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Thanh toán lịch hẹn, bán gói riêng, hủy hóa đơn (UC-08, UC-09, UC-10; 07 §3.6, §3.7, §4.6).</summary>
public sealed class InvoiceService(
    IGenericRepository<Invoice> invoices,
    IGenericRepository<Appointment> appointments,
    IGenericRepository<Customer> customers,
    IGenericRepository<Service> services,
    IGenericRepository<StaffMember> staff,
    IGenericRepository<PackageTemplate> templates,
    IGenericRepository<CustomerPackage> packages,
    IGenericRepository<PackageUsage> usages,
    IGenericRepository<Commission> commissions,
    IGenericRepository<CommissionPeriod> periods,
    IBookingContext context,
    IUnitOfWork unitOfWork) : IInvoiceService
{
    public async Task<CreateResult<InvoiceDto>> CheckoutAsync(CheckoutRequest request, CancellationToken ct = default)
    {
        var (id, created) = await BookingGate.RunAsync(async () =>
        {
            if (await FindByRequestIdAsync(request.ClientRequestId, ct) is { } repeat)
                return (repeat, false);

            var invoiceId = Guid.Empty;
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var appointment = await appointments.Query().Include(a => a.Lines).FirstOrDefaultAsync(a => a.Id == request.AppointmentId, token)
                                  ?? throw new NotFoundException("Không tìm thấy lịch hẹn.");
                if (appointment.Status != AppointmentStatus.DangPhucVu)
                    throw BookingProblems.InvalidState(appointment.Status == AppointmentStatus.HoanThanh
                        ? "Lịch hẹn đã thanh toán."
                        : "Chỉ thanh toán lịch đang phục vụ (đã check-in).");
                var customer = await customers.QueryNoTracking().FirstAsync(c => c.Id == appointment.CustomerId, token);
                var actor = await context.GetActorAsync(token);

                var serviceIds = appointment.Lines.Select(l => l.ServiceId).ToList();
                var catalog = await services.QueryNoTracking().Where(s => serviceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, token);
                var names = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, s => s.FullName, token);
                var sales = await ResolveSalesAsync(request.SellPackages.Select(s => (s.PackageTemplateId, s.ConsultantStaffId)).ToList(), "sellPackages", token);
                var relevant = serviceIds.Concat(sales.Select(s => s.Template.ServiceId)).Distinct().ToList();
                var (owned, lastUsed) = await LoadPackagesAsync(customer.Id, relevant, token);

                var draft = new CheckoutDraft
                {
                    Appointment = appointment,
                    Customer = customer,
                    Lines = appointment.Lines.OrderBy(l => l.SortOrder).Select(l => new CheckoutLineSource(
                        l, names.GetValueOrDefault(l.StaffMemberId, string.Empty),
                        catalog.TryGetValue(l.ServiceId, out var s) ? s.CommissionType : CommissionType.PhanTram,
                        catalog.TryGetValue(l.ServiceId, out var s2) ? s2.CommissionValue : 0)).ToList(),
                    UsePackage = request.Lines.ToDictionary(l => l.AppointmentLineId, l => l.UsePackage),
                    Packages = owned,
                    LastUsedDate = pid => lastUsed.TryGetValue(pid, out var d) ? d : null,
                    Sales = sales,
                    Discount = request.Discount is { Value: > 0 } d ? new CheckoutDiscount(d.Type, d.Value, d.Reason) : null,
                    DiscountLimitPercent = CheckoutMath.DiscountLimit(actor.Has(ProjectPermissions.Invoices.Discount), actor.Has(ProjectPermissions.Invoices.DiscountHigh)),
                    Method = request.Method,
                    CashReceived = request.CashReceived,
                    CardAuthCode = request.CardAuthCode?.Trim(),
                    OverrideReason = request.IntervalOverrideReason,
                    Now = context.UtcNow,
                    CashierName = actor.FullName,
                    ClientRequestId = request.ClientRequestId
                };
                invoiceId = await SaveAsync(draft, request.ExpectedTotal, token);
            }, ct);
            return (invoiceId, true);
        }, ct);
        return new CreateResult<InvoiceDto>(await GetAsync(id, ct), created);
    }

    public async Task<CreateResult<InvoiceDto>> SellPackageAsync(PackageSaleRequest request, CancellationToken ct = default)
    {
        var (id, created) = await BookingGate.RunAsync(async () =>
        {
            if (await FindByRequestIdAsync(request.ClientRequestId, ct) is { } repeat)
                return (repeat, false);

            var invoiceId = Guid.Empty;
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var customer = await customers.QueryNoTracking().FirstOrDefaultAsync(c => c.Id == request.CustomerId, token)
                               ?? throw new ValidationException([new ValidationFailure("customerId", "Chọn khách")]);
                var actor = await context.GetActorAsync(token);
                var sales = await ResolveSalesAsync([(request.PackageTemplateId, request.ConsultantStaffId ?? Guid.Empty)], null, token);
                var draft = new CheckoutDraft
                {
                    Customer = customer,
                    LastUsedDate = _ => null,
                    Sales = sales,
                    Method = request.Method,
                    CashReceived = request.CashReceived,
                    CardAuthCode = request.CardAuthCode?.Trim(),
                    Now = context.UtcNow,
                    CashierName = actor.FullName,
                    ClientRequestId = request.ClientRequestId
                };
                invoiceId = await SaveAsync(draft, request.ExpectedTotal, token);
            }, ct);
            return (invoiceId, true);
        }, ct);
        return new CreateResult<InvoiceDto>(await GetAsync(id, ct), created);
    }

    public async Task<InvoiceDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var invoice = await invoices.QueryNoTracking().Include(i => i.Lines).Include(i => i.Customer).FirstOrDefaultAsync(i => i.Id == id, ct)
                      ?? throw new NotFoundException("Không tìm thấy hóa đơn.");
        return (await ToDtosAsync([invoice], ct)).Single();
    }

    public async Task<PaginatedResult<InvoiceDto>> GetPagedAsync(InvoiceQuery query, CancellationToken ct = default)
    {
        var source = invoices.QueryNoTracking().Include(i => i.Lines).Include(i => i.Customer).AsQueryable();
        if (query.CustomerId is { } cid)
            source = source.Where(i => i.CustomerId == cid);
        if (VietnamDates.TryParse(query.From, out var from))
        {
            var start = VietnamDates.StartOfDayUtc(from);
            source = source.Where(i => i.PaidAt >= start);
        }

        if (VietnamDates.TryParse(query.To, out var to))
        {
            var end = VietnamDates.EndOfDayExclusiveUtc(to);
            source = source.Where(i => i.PaidAt < end);
        }

        if (string.IsNullOrWhiteSpace(query.SortBy))
            query.SortBy = "paidAt";
        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var dtos = await ToDtosAsync(page.Items, ct);
        return page.Map(_ => dtos);
    }

    public async Task<InvoiceDto> CancelAsync(Guid id, CancelInvoiceRequest request, CancellationToken ct = default)
    {
        await BookingGate.RunAsync(async () =>
        {
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var invoice = await invoices.Query().FirstOrDefaultAsync(i => i.Id == id, token) ?? throw new NotFoundException("Không tìm thấy hóa đơn.");
                if (await InvoiceSupport.CancelBlockAsync(invoice, VietnamDates.DateOf, periods, packages, usages, token) is { } block)
                    throw BookingProblems.Conflict(block.Code, block.Message);
                var actor = await context.GetActorAsync(token);
                var now = context.UtcNow;

                // Trả lại buổi đã trừ (BR-26).
                var used = await usages.Query().Where(u => u.InvoiceId == id && !u.Refunded).ToListAsync(token);
                var touchedIds = used.Select(u => u.CustomerPackageId).Distinct().ToList();
                var touched = await packages.Query().Where(p => touchedIds.Contains(p.Id) || p.InvoiceId == id).ToListAsync(token);
                foreach (var usage in used)
                {
                    usage.Refunded = true;
                    usage.RefundedAt = now;
                    var package = touched.First(p => p.Id == usage.CustomerPackageId);
                    package.UsedSessions = Math.Max(0, package.UsedSessions - 1);
                    if (package.Status == CustomerPackageStatus.DaDungHet && package.Remaining > 0)
                        package.Status = package.ExpiryDate < context.Today ? CustomerPackageStatus.HetHan : CustomerPackageStatus.DangDung;
                }

                foreach (var sold in touched.Where(p => p.InvoiceId == id))
                    sold.Status = CustomerPackageStatus.DaHuy;

                commissions.DeleteRange(await commissions.Query().Where(c => c.InvoiceId == id).ToListAsync(token));

                if (invoice.AppointmentId is { } aid && await appointments.GetByIdAsync(aid, token) is { } appointment)
                {
                    appointment.Status = AppointmentStatus.DangPhucVu;
                    appointment.CompletedAt = null;
                }

                invoice.Status = InvoiceStatus.DaHuy;
                invoice.CancelReason = request.Reason!.Trim();
                invoice.CancelledAt = now;
                invoice.CancelledByName = actor.FullName;
                await unitOfWork.SaveChangesAsync(token);
            }, ct);
            return true;
        }, ct);
        return await GetAsync(id, ct);
    }

    // ───────────────────────────── Hỗ trợ

    private async Task<Guid?> FindByRequestIdAsync(string? clientRequestId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(clientRequestId))
            return null;
        var key = clientRequestId.Trim();
        return await invoices.QueryNoTracking().Where(i => i.ClientRequestId == key).Select(i => (Guid?)i.Id).FirstOrDefaultAsync(ct);
    }

    private async Task<List<CheckoutSaleSource>> ResolveSalesAsync(IReadOnlyList<(Guid TemplateId, Guid ConsultantId)> requested, string? prefix, CancellationToken ct)
    {
        var result = new List<CheckoutSaleSource>();
        var failures = new List<ValidationFailure>();
        for (var i = 0; i < requested.Count; i++)
        {
            var (templateId, consultantId) = requested[i];
            var field = prefix is null ? string.Empty : $"{prefix}[{i}].";
            var template = await templates.QueryNoTracking().Include(t => t.Service).FirstOrDefaultAsync(t => t.Id == templateId, ct);
            if (template is null || !template.IsActive)
            {
                failures.Add(new ValidationFailure($"{field}packageTemplateId", template is null ? "Chọn gói" : $"Gói {template.Name} đã ngừng bán"));
                continue;
            }

            var consultant = await staff.QueryNoTracking().FirstOrDefaultAsync(s => s.Id == consultantId && s.IsActive, ct);
            if (consultant is null)
            {
                failures.Add(new ValidationFailure($"{field}consultantStaffId", "Chọn người tư vấn"));
                continue;
            }

            result.Add(new CheckoutSaleSource(template, template.Service!.Name, consultant.Id, consultant.FullName));
        }

        if (failures.Count > 0)
            throw new ValidationException(failures);
        return result;
    }

    private async Task<(List<CustomerPackage> Owned, Dictionary<Guid, DateOnly> LastUsed)> LoadPackagesAsync(
        Guid customerId, IReadOnlyCollection<Guid> serviceIds, CancellationToken ct)
    {
        var ids = serviceIds.ToList();
        var owned = await packages.Query().Where(p => p.CustomerId == customerId && ids.Contains(p.ServiceId)).ToListAsync(ct);
        var packageIds = owned.Select(p => p.Id).ToList();
        var last = await usages.QueryNoTracking()
            .Where(u => packageIds.Contains(u.CustomerPackageId) && !u.Refunded)
            .GroupBy(u => u.CustomerPackageId)
            .Select(g => new { g.Key, Last = g.Max(u => u.UsedAt) })
            .ToListAsync(ct);
        return (owned, last.ToDictionary(x => x.Key, x => VietnamDates.DateOf(x.Last)));
    }

    /// <summary>Tính, kiểm tra, dựng và lưu hóa đơn (07 §3.6 bước 1–8).</summary>
    private async Task<Guid> SaveAsync(CheckoutDraft draft, decimal expectedTotal, CancellationToken ct)
    {
        var result = InvoiceBuilder.Compute(draft);
        var failures = result.Errors.Select(e => new ValidationFailure(e.Key, e.Value)).ToList();
        if (result.RequiresOverrideReason && string.IsNullOrWhiteSpace(draft.OverrideReason))
        {
            var warning = result.Lines.First(l => l.UsesPackage && l.IntervalWarning is not null).IntervalWarning;
            failures.Add(new ValidationFailure("intervalOverrideReason", $"{warning}. Nhập lý do để trừ buổi"));
        }

        failures.AddRange(InvoiceBuilder.PaymentErrors(result.Total, draft.Method, draft.CashReceived, draft.CardAuthCode)
            .Select(e => new ValidationFailure(e.Key, e.Value)));
        if (failures.Count > 0)
            throw new ValidationException(failures);

        if (expectedTotal != result.Total)
            throw BookingProblems.Conflict(BookingErrorCodes.TongTienDaDoi,
                $"Tổng tiền đã thay đổi thành {BookingRules.FormatVnd(result.Total)}, vui lòng kiểm tra lại.",
                extra: new Dictionary<string, object?> { ["serverTotal"] = result.Total });

        // Cấp mã trước (hóa đơn rồi tới từng gói bán) vì InvoiceBuilder gọi theo đúng thứ tự đó.
        var payDate = VietnamDates.DateOf(draft.Now);
        var queue = new Dictionary<string, Queue<string>>
        {
            [BookingRules.InvoicePrefix] = new([await context.NextCodeAsync(BookingRules.InvoicePrefix, payDate, ct)]),
            [BookingRules.PackagePrefix] = new()
        };
        foreach (var _ in result.Sales)
            queue[BookingRules.PackagePrefix].Enqueue(await context.NextCodeAsync(BookingRules.PackagePrefix, payDate, ct));

        var outcome = InvoiceBuilder.Apply(draft, result, prefix => queue[prefix].Dequeue());
        await invoices.AddAsync(outcome.Invoice, ct);
        await packages.AddRangeAsync(outcome.NewPackages, ct);
        await usages.AddRangeAsync(outcome.Usages, ct);
        await commissions.AddRangeAsync(outcome.Commissions, ct);
        await EnsurePeriodAsync(BookingRules.MonthKey(payDate), ct);
        await unitOfWork.SaveChangesAsync(ct);
        return outcome.Invoice.Id;
    }

    private async Task EnsurePeriodAsync(int month, CancellationToken ct)
    {
        if (!await periods.AnyAsync(p => p.Month == month, ct))
            await periods.AddAsync(new CommissionPeriod { Month = month, Code = BookingRules.CommissionPeriodCode(month), Status = CommissionPeriodStatus.TamTinh }, ct);
    }

    private async Task<List<InvoiceDto>> ToDtosAsync(IReadOnlyList<Invoice> list, CancellationToken ct)
    {
        var actor = await context.GetActorAsync(ct);
        var ids = list.Select(i => i.Id).ToList();
        var lineCommissions = await commissions.QueryNoTracking()
            .Where(c => ids.Contains(c.InvoiceId))
            .Select(c => new { c.InvoiceLineId, c.Amount })
            .ToListAsync(ct);
        var appointmentIds = list.Where(i => i.AppointmentId != null).Select(i => i.AppointmentId!.Value).ToList();
        var codes = await appointments.QueryNoTracking().Where(a => appointmentIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id, a => a.Code, ct);
        var result = new List<InvoiceDto>();
        foreach (var i in list)
        {
            var block = await InvoiceSupport.CancelBlockAsync(i, VietnamDates.DateOf, periods, packages, usages, ct);
            var canCancelPermission = actor.Has(ProjectPermissions.Invoices.Cancel);
            result.Add(new InvoiceDto
            {
                Id = i.Id,
                Code = i.Code,
                AppointmentId = i.AppointmentId,
                AppointmentCode = i.AppointmentId is { } aid ? codes.GetValueOrDefault(aid) : null,
                Customer = new CustomerRef(i.CustomerId, i.Customer?.Code ?? string.Empty, i.Customer?.FullName ?? string.Empty, i.Customer?.Phone ?? string.Empty),
                PaidAt = i.PaidAt,
                CashierName = i.CashierName,
                ServiceTotal = i.ServiceTotal,
                PackageTotal = i.PackageTotal,
                DiscountType = i.DiscountType,
                DiscountValue = i.DiscountValue,
                DiscountAmount = i.DiscountAmount,
                DiscountReason = i.DiscountReason,
                Total = i.Total,
                Method = i.Method,
                CashReceived = i.CashReceived,
                ChangeAmount = i.ChangeAmount,
                CardAuthCode = i.CardAuthCode,
                IntervalOverrideReason = i.IntervalOverrideReason,
                Status = i.Status,
                CancelReason = i.CancelReason,
                CancelledAt = i.CancelledAt,
                CancelledByName = i.CancelledByName,
                CanCancel = block is null && canCancelPermission,
                CancelBlockedReason = i.Status == InvoiceStatus.DaThanhToan ? block?.Message ?? (canCancelPermission ? null : "Chỉ chủ tiệm hủy được hóa đơn") : null,
                Lines = i.Lines.OrderBy(l => l.SortOrder).Select(l => new InvoiceLineDto
                {
                    Id = l.Id,
                    Kind = l.Kind,
                    Description = l.Description,
                    StaffName = l.StaffName,
                    DurationMinutes = l.DurationMinutes,
                    ListPrice = l.ListPrice,
                    UsesPackage = l.UsesPackage,
                    Amount = l.Amount,
                    BasePrice = l.BasePrice,
                    PackageCode = l.PackageCode,
                    PackageRemaining = l.PackageRemaining,
                    PackageExpiryDate = l.PackageExpiryDate,
                    CommissionAmount = lineCommissions.Where(c => c.InvoiceLineId == l.Id).Sum(c => c.Amount)
                }).ToList()
            });
        }

        return result;
    }
}
