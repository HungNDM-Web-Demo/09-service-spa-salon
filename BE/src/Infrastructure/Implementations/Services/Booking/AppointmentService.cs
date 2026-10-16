using Application.Common.Exceptions;
using Application.Common.Models;
using Application.Common.Time;
using Application.Constants;
using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Validators.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.Services;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.Commissions;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using Infrastructure.Extensions;
using Infrastructure.Implementations.Services.Crm;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Lịch hẹn tại quầy, lưới, xác nhận, đổi giờ, kéo thả, hủy, check-in, không đến (UC-03, UC-05, UC-07; 07 §3.2, §4.4).</summary>
public sealed class AppointmentService(
    IGenericRepository<Appointment> appointments,
    IGenericRepository<Service> services,
    IGenericRepository<StaffMember> staff,
    IGenericRepository<Customer> customers,
    IGenericRepository<Invoice> invoices,
    IGenericRepository<CommissionPeriod> periods,
    IGenericRepository<CustomerPackage> packages,
    IGenericRepository<PackageUsage> usages,
    IBookingContext context,
    IUnitOfWork unitOfWork) : IAppointmentService
{
    private static readonly AppointmentStatus[] Editable = [AppointmentStatus.ChoXacNhan, AppointmentStatus.DaXacNhan];

    public async Task<BoardDto> GetBoardAsync(string? date, CancellationToken ct = default)
    {
        var day = VietnamDates.TryParse(date, out var d) ? d : context.Today;
        var schedule = await context.LoadDayAsync(day, ct);
        var list = await appointments.QueryNoTracking()
            .Include(a => a.Lines).Include(a => a.Customer)
            .Where(a => a.Date == day && (a.Status == AppointmentStatus.ChoXacNhan || a.Status == AppointmentStatus.DaXacNhan
                                          || a.Status == AppointmentStatus.DangPhucVu || a.Status == AppointmentStatus.HoanThanh))
            .ToListAsync(ct);
        var cards = await BuildCardsAsync(list, ct);
        var withLines = list.SelectMany(a => a.Lines).Select(l => l.StaffMemberId).ToHashSet();
        var colors = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, s => s.Color, ct);

        var technicians = schedule.Staff
            .Where(s => (s.IsActive && s.DayOffReason is null && s.Shift != ShiftType.Nghi && schedule.ClosedReason is null) || withLines.Contains(s.Id))
            .Select(s =>
            {
                var window = s.DayOffReason is null ? BookingRules.ShiftWindow(s.Shift, schedule.Open, schedule.Close) : null;
                return new BoardTechnicianDto
                {
                    Id = s.Id,
                    Code = s.Code,
                    FullName = s.FullName,
                    Color = colors.GetValueOrDefault(s.Id, "#64748B"),
                    Shift = window is null ? null : s.Shift,
                    ShiftStart = window?.Start,
                    ShiftEnd = window?.End,
                    OffReason = s.DayOffReason ?? (window is null ? $"Nghỉ {BookingRules.DayOfWeekLabel(BookingRules.IsoDayOfWeek(day))}" : null),
                    ServiceIds = s.ServiceIds.ToList()
                };
            })
            .ToList();

        return new BoardDto
        {
            Date = day,
            OpenMinute = schedule.Open,
            CloseMinute = schedule.Close,
            ShopClosedReason = schedule.ClosedReason,
            Technicians = technicians,
            Appointments = cards
        };
    }

    public async Task<PaginatedResult<AppointmentListItem>> GetPagedAsync(AppointmentQuery query, CancellationToken ct = default)
    {
        var source = appointments.QueryNoTracking().Include(a => a.Lines).Include(a => a.Customer).AsQueryable();
        if (query.CustomerId is { } cid)
            source = source.Where(a => a.CustomerId == cid);
        if (VietnamDates.TryParse(query.From, out var from))
            source = source.Where(a => a.Date >= from);
        if (VietnamDates.TryParse(query.To, out var to))
            source = source.Where(a => a.Date <= to);
        if (query.Status is { } status)
            source = source.Where(a => a.Status == status);
        var term = query.GetSearchTerm();
        if (term is not null)
        {
            var pattern = LikePattern.Contains(term);
            var digits = BookingValidationRules.Digits(term);
            var phonePattern = LikePattern.Contains(digits.Length > 0 ? digits : term);
            source = source.Where(a => AppDbFunctions.Matches(a.Code, pattern) || AppDbFunctions.Matches(a.Customer!.FullName, pattern)
                                       || AppDbFunctions.Matches(a.Customer.Phone, phonePattern));
        }

        var page = await source.ApplySorting(query).ToPaginatedResultAsync(query, ct);
        var names = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        return page.Map(items => items.Select(a => new AppointmentListItem
        {
            Id = a.Id,
            Code = a.Code,
            Date = a.Date,
            StartAt = a.StartAt,
            EndAt = a.EndAt,
            Status = a.Status,
            Source = a.Source,
            CustomerId = a.CustomerId,
            CustomerName = a.Customer!.FullName,
            CustomerPhone = a.Customer.Phone,
            Services = string.Join(", ", a.Lines.OrderBy(l => l.SortOrder).Select(l => l.ServiceName)),
            StaffNames = string.Join(", ", a.Lines.OrderBy(l => l.SortOrder).Select(l => names.GetValueOrDefault(l.StaffMemberId, "")).Distinct()),
            Amount = a.Lines.Sum(l => l.Price),
            CreatedAt = a.CreatedAt
        }).ToList());
    }

    public Task<AppointmentDetailDto> GetAsync(Guid id, CancellationToken ct = default) => BuildDetailAsync(id, ct);

    public async Task<CheckResultDto> CheckAsync(CheckAppointmentRequest request, CancellationToken ct = default)
    {
        Appointment? existing = null;
        if (request.AppointmentId is { } aid)
            existing = await appointments.QueryNoTracking().Include(a => a.Lines).FirstOrDefaultAsync(a => a.Id == aid, ct);
        if (request.Lines.Count == 0)
            return new CheckResultDto { Ok = false, Issues = [new IssueDto(ScheduleEngine.Codes.SoDong, "Thêm ít nhất một dịch vụ")] };
        var (schedule, draft, date) = await BuildDraftAsync(request.Lines, existing, ct);
        if (schedule is null)
            return new CheckResultDto { Ok = false, Issues = [new IssueDto(ScheduleEngine.Codes.SoDong, "Các dòng dịch vụ phải cùng một ngày")] };
        var check = ScheduleEngine.CheckDraft(schedule, draft, existing?.Id, request.CustomerId ?? existing?.CustomerId);
        return ToDto(check, date);
    }

    public async Task<SuggestionsDto> SuggestAsync(SuggestionQuery query, CancellationToken ct = default)
    {
        var service = await services.QueryNoTracking().FirstOrDefaultAsync(s => s.Id == query.ServiceId, ct)
                      ?? throw new NotFoundException("Không tìm thấy dịch vụ.");
        var (date, minute) = context.ToLocal(query.StartAt);
        var schedule = await context.LoadDayAsync(date, ct);
        var (free, slots) = ScheduleEngine.Suggest(
            schedule,
            new ScheduleService(service.Id, service.Name, service.DurationMinutes, service.CleanupMinutes, service.Price),
            query.StaffMemberId,
            minute,
            [],
            query.AppointmentId);
        var options = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, ct);
        return new SuggestionsDto
        {
            FreeTechnicians = free.Select(s => options[s.Id]).Select(s => new StaffOption(s.Id, s.Code, s.FullName, s.Kind, s.Color)).ToList(),
            NextSlots = slots.Select(m => context.ToUtc(date, m)).ToList()
        };
    }

    public async Task<AppointmentDetailDto> CreateAsync(CreateAppointmentRequest request, CancellationToken ct = default)
    {
        var id = await BookingGate.RunAsync(async () =>
        {
            Guid created = Guid.Empty;
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var actor = await context.GetActorAsync(token);
                Customer customer;
                var isNew = false;
                if (request.CustomerId is { } cid)
                {
                    customer = await customers.GetByIdAsync(cid, token) ?? throw new NotFoundException("Không tìm thấy khách.");
                }
                else
                {
                    var phone = BookingValidationRules.Digits(request.NewCustomer!.Phone!);
                    var found = await customers.Query().FirstOrDefaultAsync(c => c.Phone == phone, token);
                    if (found is not null)
                    {
                        customer = found;
                    }
                    else
                    {
                        customer = new Customer { Phone = phone, FullName = request.NewCustomer.FullName!.Trim(), Code = await CustomerService.NextCodeAsync(customers, token) };
                        isNew = true;
                    }
                }

                var (schedule, draft, date) = await BuildDraftAsync(request.Lines, null, token);
                if (schedule is null)
                    throw SameDayProblem();
                var check = ScheduleEngine.CheckDraft(schedule, draft, null, isNew ? null : customer.Id);
                if (!check.Ok)
                    throw ScheduleProblem.From(check, m => context.ToUtc(date, m));

                if (isNew)
                    await customers.AddAsync(customer, token);

                var appointment = new Appointment
                {
                    Code = await context.NextCodeAsync(BookingRules.AppointmentPrefix, context.Today, token),
                    CustomerId = customer.Id,
                    Source = request.Source,
                    Status = AppointmentStatus.DaXacNhan,
                    Note = Clean(request.Note),
                    CreatedByName = actor.FullName,
                    ConfirmedAt = context.UtcNow,
                    ConfirmedByName = actor.FullName
                };
                appointment.Lines = draft.Select((l, i) => NewLine(appointment.Id, l, date, i + 1)).ToList();
                appointment.RefreshSpan(VietnamDates.DateOf);
                await AddMessageAsync(appointment, customer, MessageKind.XacNhan, null, token);
                await appointments.AddAsync(appointment, token);
                await unitOfWork.SaveChangesAsync(token);
                created = appointment.Id;
            }, ct);
            return created;
        }, ct);
        return await BuildDetailAsync(id, ct);
    }

    public async Task<AppointmentDetailDto> UpdateAsync(Guid id, UpdateAppointmentRequest request, CancellationToken ct = default)
    {
        await BookingGate.RunAsync(async () =>
        {
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var appointment = await LoadTrackedAsync(id, token);
                var now = context.UtcNow;
                if (appointment.Status is not (AppointmentStatus.ChoXacNhan or AppointmentStatus.DaXacNhan or AppointmentStatus.DangPhucVu))
                    throw BookingProblems.InvalidState($"Lịch hẹn {StatusLabel(appointment.Status).ToLowerInvariant()}, không sửa được.");

                // BR-09: lịch đang phục vụ giữ nguyên các dòng đã tới giờ.
                if (appointment.Status == AppointmentStatus.DangPhucVu)
                {
                    foreach (var started in appointment.Lines.Where(l => l.StartAt <= now))
                    {
                        var sent = request.Lines.FirstOrDefault(l => l.LineId == started.Id);
                        if (sent is null || sent.StaffMemberId != started.StaffMemberId || sent.ServiceId != started.ServiceId || sent.StartAt != started.StartAt)
                            throw BookingProblems.InvalidState($"Dòng {started.ServiceName} đã bắt đầu, không đổi hoặc bỏ được.");
                    }
                }

                var (schedule, draft, date) = await BuildDraftAsync(request.Lines, appointment, token);
                if (schedule is null)
                    throw SameDayProblem();
                var check = ScheduleEngine.CheckDraft(schedule, draft, appointment.Id, appointment.CustomerId);
                if (!check.Ok)
                    throw ScheduleProblem.From(check, m => context.ToUtc(date, m));

                var moved = ApplyDraft(appointment, draft, date);
                if (request.Source is { } source)
                    appointment.Source = source;
                appointment.Note = Clean(request.Note);
                appointment.RefreshSpan(VietnamDates.DateOf);
                if (moved && appointment.Status != AppointmentStatus.DangPhucVu)
                {
                    var customer = await customers.QueryNoTracking().FirstAsync(c => c.Id == appointment.CustomerId, token);
                    await AddMessageAsync(appointment, customer, MessageKind.DoiLich, null, token);
                }

                await unitOfWork.SaveChangesAsync(token);
            }, ct);
            return true;
        }, ct);
        return await BuildDetailAsync(id, ct);
    }

    public async Task<AppointmentDetailDto> MoveLineAsync(Guid id, Guid lineId, MoveLineRequest request, CancellationToken ct = default)
    {
        await BookingGate.RunAsync(async () =>
        {
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var appointment = await LoadTrackedAsync(id, token);
                var line = appointment.Lines.FirstOrDefault(l => l.Id == lineId) ?? throw new NotFoundException("Không tìm thấy dòng dịch vụ.");
                var movable = Editable.Contains(appointment.Status)
                              || (appointment.Status == AppointmentStatus.DangPhucVu && line.StartAt > context.UtcNow);
                if (!movable)
                    throw BookingProblems.InvalidState(appointment.Status == AppointmentStatus.DangPhucVu
                        ? $"Dòng {line.ServiceName} đã bắt đầu, không đổi giờ được."
                        : $"Lịch hẹn {StatusLabel(appointment.Status).ToLowerInvariant()}, không đổi giờ được.");

                var requests = appointment.Lines.Select(l => new DraftLineRequest
                {
                    LineId = l.Id,
                    ServiceId = l.ServiceId,
                    StaffMemberId = l.Id == lineId ? request.StaffMemberId : l.StaffMemberId,
                    StartAt = l.Id == lineId ? request.StartAt : l.StartAt
                }).ToList();
                var (schedule, draft, date) = await BuildDraftAsync(requests, appointment, token);
                if (schedule is null)
                    throw SameDayProblem();
                var check = ScheduleEngine.CheckDraft(schedule, draft, appointment.Id, appointment.CustomerId);
                if (!check.Ok)
                    throw ScheduleProblem.From(check, m => context.ToUtc(date, m));

                if (ApplyDraft(appointment, draft, date))
                {
                    appointment.RefreshSpan(VietnamDates.DateOf);
                    if (appointment.Status != AppointmentStatus.DangPhucVu)
                    {
                        var customer = await customers.QueryNoTracking().FirstAsync(c => c.Id == appointment.CustomerId, token);
                        await AddMessageAsync(appointment, customer, MessageKind.DoiLich, null, token);
                    }

                    await unitOfWork.SaveChangesAsync(token);
                }
            }, ct);
            return true;
        }, ct);
        return await BuildDetailAsync(id, ct);
    }

    public Task<AppointmentDetailDto> ConfirmAsync(Guid id, CancellationToken ct = default) =>
        MutateAsync(id, async (appointment, customer, actor, token) =>
        {
            if (appointment.Status != AppointmentStatus.ChoXacNhan)
                throw BookingProblems.InvalidState("Chỉ xác nhận được lịch đang chờ xác nhận.");
            appointment.Status = AppointmentStatus.DaXacNhan;
            appointment.ConfirmedAt = context.UtcNow;
            appointment.ConfirmedByName = actor.FullName;
            await AddMessageAsync(appointment, customer, MessageKind.XacNhan, null, token);
        }, ct);

    public Task<AppointmentDetailDto> RejectAsync(Guid id, CancelAppointmentRequest request, CancellationToken ct = default) =>
        MutateAsync(id, async (appointment, customer, actor, token) =>
        {
            if (appointment.Status != AppointmentStatus.ChoXacNhan)
                throw BookingProblems.InvalidState("Chỉ từ chối được lịch đang chờ xác nhận.");
            await CancelCoreAsync(appointment, customer, actor, request, token);
        }, ct);

    public Task<AppointmentDetailDto> CancelAsync(Guid id, CancelAppointmentRequest request, CancellationToken ct = default) =>
        MutateAsync(id, async (appointment, customer, actor, token) =>
        {
            if (!Editable.Contains(appointment.Status))
                throw BookingProblems.InvalidState($"Lịch hẹn {StatusLabel(appointment.Status).ToLowerInvariant()}, không hủy được.");
            await CancelCoreAsync(appointment, customer, actor, request, token);
        }, ct);

    public Task<AppointmentDetailDto> CheckInAsync(Guid id, CancellationToken ct = default) =>
        MutateAsync(id, async (appointment, customer, actor, token) =>
        {
            if (appointment.Date != context.Today || !Editable.Contains(appointment.Status))
                throw BookingProblems.InvalidState("Chỉ check-in lịch của hôm nay đang chờ hoặc đã xác nhận.");
            var wasPending = appointment.Status == AppointmentStatus.ChoXacNhan;
            appointment.Status = AppointmentStatus.DangPhucVu;
            appointment.CheckedInAt = context.UtcNow;
            appointment.CheckedInByName = actor.FullName;
            if (wasPending)
            {
                appointment.ConfirmedAt = context.UtcNow;
                appointment.ConfirmedByName = actor.FullName;
                await AddMessageAsync(appointment, customer, MessageKind.XacNhan, null, token);
            }
        }, ct);

    public Task<AppointmentDetailDto> NoShowAsync(Guid id, CancellationToken ct = default) =>
        MutateAsync(id, (appointment, _, actor, _) =>
        {
            if (!IsLate(appointment))
                throw BookingProblems.InvalidState("Chỉ đánh dấu không đến khi đã quá giờ hẹn 15 phút mà khách chưa check-in.");
            appointment.Status = AppointmentStatus.KhongDen;
            appointment.NoShowAt = context.UtcNow;
            appointment.NoShowByName = actor.FullName;
            return Task.CompletedTask;
        }, ct);

    public async Task<CheckoutPreviewDto> GetCheckoutPreviewAsync(Guid id, CancellationToken ct = default)
    {
        var appointment = await appointments.QueryNoTracking().Include(a => a.Lines).Include(a => a.Customer)
                              .FirstOrDefaultAsync(a => a.Id == id, ct)
                          ?? throw new NotFoundException("Không tìm thấy lịch hẹn.");
        var actor = await context.GetActorAsync(ct);
        var serviceIds = appointment.Lines.Select(l => l.ServiceId).Distinct().ToList();
        var catalog = await services.QueryNoTracking().Where(s => serviceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var names = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        var customer = appointment.Customer!;
        return new CheckoutPreviewDto
        {
            AppointmentId = appointment.Id,
            AppointmentCode = appointment.Code,
            Status = appointment.Status,
            Customer = new CustomerRef(customer.Id, customer.Code, customer.FullName, customer.Phone),
            Lines = appointment.Lines.OrderBy(l => l.SortOrder).Select(l => new CheckoutPreviewLine
            {
                AppointmentLineId = l.Id,
                ServiceId = l.ServiceId,
                ServiceName = l.ServiceName,
                StaffMemberId = l.StaffMemberId,
                StaffName = names.GetValueOrDefault(l.StaffMemberId, string.Empty),
                Price = l.Price,
                DurationMinutes = l.DurationMinutes,
                CommissionType = catalog.TryGetValue(l.ServiceId, out var s) ? s.CommissionType : CommissionType.PhanTram,
                CommissionValue = catalog.TryGetValue(l.ServiceId, out var s2) ? s2.CommissionValue : 0
            }).ToList(),
            Packages = await context.GetCustomerPackagesAsync(customer.Id, serviceIds, ct),
            DiscountLimitPercent = CheckoutMath.DiscountLimit(actor.Has(ProjectPermissions.Invoices.Discount), actor.Has(ProjectPermissions.Invoices.DiscountHigh)),
            Today = context.Today
        };
    }

    // ───────────────────────────── Hỗ trợ

    private async Task<AppointmentDetailDto> MutateAsync(
        Guid id, Func<Appointment, Customer, BookingActor, CancellationToken, Task> mutate, CancellationToken ct)
    {
        await BookingGate.RunAsync(async () =>
        {
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var appointment = await LoadTrackedAsync(id, token);
                var customer = await customers.QueryNoTracking().FirstAsync(c => c.Id == appointment.CustomerId, token);
                var actor = await context.GetActorAsync(token);
                await mutate(appointment, customer, actor, token);
                await unitOfWork.SaveChangesAsync(token);
            }, ct);
            return true;
        }, ct);
        return await BuildDetailAsync(id, ct);
    }

    private async Task CancelCoreAsync(Appointment appointment, Customer customer, BookingActor actor, CancelAppointmentRequest request, CancellationToken ct)
    {
        appointment.Status = AppointmentStatus.DaHuy;
        appointment.CancelReason = request.Reason;
        appointment.CancelNote = Clean(request.Note);
        appointment.CancelledAt = context.UtcNow;
        appointment.CancelledByName = actor.FullName;
        var reason = request.Reason == CancelReason.Khac && appointment.CancelNote is not null
            ? appointment.CancelNote
            : BookingRules.CancelReasonLabel(request.Reason);
        await AddMessageAsync(appointment, customer, MessageKind.Huy, reason, ct);
    }

    private async Task<Appointment> LoadTrackedAsync(Guid id, CancellationToken ct) =>
        await appointments.Query().Include(a => a.Lines).Include(a => a.Messages).FirstOrDefaultAsync(a => a.Id == id, ct)
        ?? throw new NotFoundException("Không tìm thấy lịch hẹn.");

    /// <summary>Dựng bản nháp cho <see cref="ScheduleEngine"/>; dòng khác ngày nhau trả schedule null.</summary>
    private async Task<(DaySchedule? Schedule, List<DraftLine> Draft, DateOnly Date)> BuildDraftAsync(
        IReadOnlyList<DraftLineRequest> requests, Appointment? existing, CancellationToken ct)
    {
        var serviceIds = requests.Select(r => r.ServiceId).Distinct().ToList();
        var catalog = await services.QueryNoTracking().Include(s => s.Group).Where(s => serviceIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var locals = requests.Select(r => context.ToLocal(r.StartAt)).ToList();
        var date = locals.Count > 0 ? locals[0].Date : context.Today;
        if (locals.Any(l => l.Date != date))
            return (null, [], date);

        var draft = new List<DraftLine>();
        for (var i = 0; i < requests.Count; i++)
        {
            var r = requests[i];
            var old = r.LineId is { } lid ? existing?.Lines.FirstOrDefault(l => l.Id == lid) : null;
            ScheduleService svc;
            if (old is not null && old.ServiceId == r.ServiceId)
            {
                svc = new ScheduleService(old.ServiceId, old.ServiceName, old.DurationMinutes, old.CleanupMinutes, old.Price);
            }
            else
            {
                if (!catalog.TryGetValue(r.ServiceId, out var current))
                    throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure($"lines[{i}].serviceId", "Dịch vụ không tồn tại")]);
                if (!current.IsVisible || current.Group is { IsVisible: false })
                    throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure($"lines[{i}].serviceId", $"Dịch vụ {current.Name} đang ẩn")]);
                svc = new ScheduleService(current.Id, current.Name, current.DurationMinutes, current.CleanupMinutes, current.Price);
            }

            var unchanged = old is not null && old.ServiceId == r.ServiceId && old.StaffMemberId == r.StaffMemberId && old.StartAt == r.StartAt;
            draft.Add(new DraftLine(r.LineId, svc, r.StaffMemberId, locals[i].Minute, unchanged));
        }

        return (await context.LoadDayAsync(date, ct), draft, date);
    }

    /// <summary>Áp bản nháp vào lịch đang theo dõi; trả true khi có dòng đổi giờ, đổi KTV, thêm, bỏ.</summary>
    private bool ApplyDraft(Appointment appointment, IReadOnlyList<DraftLine> draft, DateOnly date)
    {
        var changed = false;
        var keep = draft.Where(d => d.LineId is not null).Select(d => d.LineId!.Value).ToHashSet();
        foreach (var removed in appointment.Lines.Where(l => !keep.Contains(l.Id)).ToList())
        {
            appointment.Lines.Remove(removed);
            changed = true;
        }

        var order = appointment.Lines.Count == 0 ? 0 : appointment.Lines.Max(l => l.SortOrder);
        foreach (var d in draft)
        {
            var line = d.LineId is { } lid ? appointment.Lines.FirstOrDefault(l => l.Id == lid) : null;
            if (line is null)
            {
                appointment.Lines.Add(NewLine(appointment.Id, d, date, ++order));
                changed = true;
                continue;
            }

            var start = context.ToUtc(date, d.Start);
            if (line.ServiceId != d.Service.Id)
            {
                line.ServiceId = d.Service.Id;
                line.ServiceName = d.Service.Name;
                line.Price = d.Service.Price;
                line.DurationMinutes = d.Service.Duration;
                line.CleanupMinutes = d.Service.Cleanup;
                changed = true;
            }

            if (line.StaffMemberId != d.StaffId || line.StartAt != start)
                changed = true;
            line.StaffMemberId = d.StaffId;
            line.StartAt = start;
            line.EndAt = start.AddMinutes(line.DurationMinutes);
        }

        return changed;
    }

    private AppointmentLine NewLine(Guid appointmentId, DraftLine d, DateOnly date, int order)
    {
        var start = context.ToUtc(date, d.Start);
        return new AppointmentLine
        {
            AppointmentId = appointmentId,
            ServiceId = d.Service.Id,
            ServiceName = d.Service.Name,
            Price = d.Service.Price,
            DurationMinutes = d.Service.Duration,
            CleanupMinutes = d.Service.Cleanup,
            StaffMemberId = d.StaffId,
            StartAt = start,
            EndAt = start.AddMinutes(d.Service.Duration),
            SortOrder = order
        };
    }

    private async Task AddMessageAsync(Appointment appointment, Customer customer, MessageKind kind, string? reason, CancellationToken ct)
    {
        var store = await context.GetStoreAsync(ct);
        var start = appointment.Lines.Count > 0 ? appointment.Lines.Min(l => l.StartAt) : appointment.StartAt;
        var (date, minute) = context.ToLocal(start);
        var names = string.Join(", ", appointment.Lines.OrderBy(l => l.StartAt).ThenBy(l => l.SortOrder).Select(l => l.ServiceName));
        appointment.Messages.Add(new AppointmentMessage
        {
            AppointmentId = appointment.Id,
            Kind = kind,
            Channel = MessageChannel.Zalo,
            Content = BookingMessages.Build(kind, store.Name, appointment.Code, date, minute, names, customer.FullName, customer.Gender, reason),
            SentAt = context.UtcNow
        });
    }

    private bool IsLate(Appointment a) =>
        a.Date == context.Today && Editable.Contains(a.Status) && context.UtcNow >= a.StartAt.AddMinutes(BookingRules.LateMinutes);

    private bool PendingOverdue(Appointment a) =>
        a.Status == AppointmentStatus.ChoXacNhan && context.UtcNow - a.CreatedAt > TimeSpan.FromMinutes(BookingRules.PendingOverdueMinutes);

    private async Task<List<AppointmentCardDto>> BuildCardsAsync(IReadOnlyList<Appointment> list, CancellationToken ct)
    {
        var people = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, ct);
        var flags = await context.NoShowCountsAsync(list.Select(a => a.CustomerId).ToList(), ct);
        return list.OrderBy(a => a.StartAt).Select(a => ToCard(a, people, flags)).ToList();
    }

    private AppointmentCardDto ToCard(Appointment a, IReadOnlyDictionary<Guid, StaffMember> people, IReadOnlyDictionary<Guid, int> flags) => new()
    {
        Id = a.Id,
        Code = a.Code,
        Status = a.Status,
        Source = a.Source,
        CustomerId = a.CustomerId,
        CustomerName = a.Customer?.FullName ?? string.Empty,
        CustomerPhone = a.Customer?.Phone ?? string.Empty,
        IsFlagged = flags.GetValueOrDefault(a.CustomerId) >= BookingRules.NoShowFlagThreshold,
        Note = a.Note,
        CreatedAt = a.CreatedAt,
        CheckedInAt = a.CheckedInAt,
        StartAt = a.StartAt,
        EndAt = a.EndAt,
        IsLate = IsLate(a),
        PendingOverdue = PendingOverdue(a),
        Lines = a.Lines.OrderBy(l => l.SortOrder).Select(l => ToLineDto(l, people)).ToList()
    };

    private static AppointmentLineDto ToLineDto(AppointmentLine l, IReadOnlyDictionary<Guid, StaffMember> people) => new()
    {
        Id = l.Id,
        ServiceId = l.ServiceId,
        ServiceName = l.ServiceName,
        StaffMemberId = l.StaffMemberId,
        StaffName = people.TryGetValue(l.StaffMemberId, out var s) ? s.FullName : string.Empty,
        StaffColor = s?.Color ?? "#64748B",
        StartAt = l.StartAt,
        EndAt = l.EndAt,
        DurationMinutes = l.DurationMinutes,
        CleanupMinutes = l.CleanupMinutes,
        Price = l.Price,
        SortOrder = l.SortOrder
    };

    private async Task<AppointmentDetailDto> BuildDetailAsync(Guid id, CancellationToken ct)
    {
        var a = await appointments.QueryNoTracking().Include(x => x.Lines).Include(x => x.Messages).Include(x => x.Customer)
                    .FirstOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new NotFoundException("Không tìm thấy lịch hẹn.");
        var actor = await context.GetActorAsync(ct);
        var people = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, ct);
        var customer = await context.GetCustomerDtoAsync(a.CustomerId, ct);
        var card = ToCard(a, people, new Dictionary<Guid, int> { [a.CustomerId] = customer.NoShowCount90 });
        var allPackages = await context.GetCustomerPackagesAsync(a.CustomerId, null, ct);
        var invoiceList = await invoices.QueryNoTracking().Where(i => i.AppointmentId == id).OrderByDescending(i => i.PaidAt).ToListAsync(ct);
        var briefs = await InvoiceSupport.BriefsAsync(invoiceList, actor.Has(ProjectPermissions.Invoices.Cancel), VietnamDates.DateOf, periods, packages, usages, ct);
        var canUpdate = actor.Has(ProjectPermissions.Appointments.Update);
        var hasFutureLine = a.Lines.Any(l => l.StartAt > context.UtcNow);

        return new AppointmentDetailDto
        {
            Id = card.Id,
            Code = card.Code,
            Status = card.Status,
            Source = card.Source,
            CustomerId = card.CustomerId,
            CustomerName = card.CustomerName,
            CustomerPhone = card.CustomerPhone,
            IsFlagged = customer.IsFlagged,
            Note = card.Note,
            CreatedAt = card.CreatedAt,
            CheckedInAt = card.CheckedInAt,
            StartAt = card.StartAt,
            EndAt = card.EndAt,
            IsLate = card.IsLate,
            PendingOverdue = card.PendingOverdue,
            Lines = card.Lines,
            Date = a.Date,
            Customer = customer,
            Packages = allPackages.Where(p => p.Status is CustomerPackageStatus.DangDung).ToList(),
            CreatedByName = a.CreatedByName,
            ConfirmedAt = a.ConfirmedAt,
            ConfirmedByName = a.ConfirmedByName,
            CheckedInByName = a.CheckedInByName,
            CancelReason = a.CancelReason,
            CancelNote = a.CancelNote,
            CancelledAt = a.CancelledAt,
            CancelledByName = a.CancelledByName,
            NoShowAt = a.NoShowAt,
            NoShowByName = a.NoShowByName,
            CompletedAt = a.CompletedAt,
            Messages = a.Messages.OrderBy(m => m.SentAt).Select(m => new MessageDto(m.Id, m.Kind, m.Channel, m.Content, m.SentAt)).ToList(),
            Invoices = briefs,
            Actions = new AppointmentActionsDto
            {
                CanEdit = canUpdate && (Editable.Contains(a.Status) || (a.Status == AppointmentStatus.DangPhucVu)),
                CanConfirm = canUpdate && a.Status == AppointmentStatus.ChoXacNhan,
                CanReject = canUpdate && a.Status == AppointmentStatus.ChoXacNhan,
                CanCancel = actor.Has(ProjectPermissions.Appointments.Cancel) && Editable.Contains(a.Status),
                CanCheckIn = canUpdate && a.Date == context.Today && Editable.Contains(a.Status),
                CanNoShow = canUpdate && IsLate(a),
                CanCheckout = actor.Has(ProjectPermissions.Invoices.Create) && a.Status == AppointmentStatus.DangPhucVu
            }
        };
    }

    private static CheckResultDto ToDto(DraftCheck check, DateOnly date) => new()
    {
        Ok = check.Ok,
        Issues = check.Issues.Select(i => new IssueDto(i.Code, i.Message)).ToList(),
        Lines = check.Lines.Select(l => new LineCheckDto
        {
            Index = l.Index,
            StartAt = VietnamDates.StartOfDayUtc(date).AddMinutes(l.Start),
            EndAt = VietnamDates.StartOfDayUtc(date).AddMinutes(l.End),
            BlockEndAt = VietnamDates.StartOfDayUtc(date).AddMinutes(l.BlockEnd),
            Issues = l.Issues.Select(i => new IssueDto(i.Code, i.Message)).ToList()
        }).ToList()
    };

    private static Domain.Common.DomainException SameDayProblem() =>
        BookingProblems.Domain(BookingErrorCodes.LichKhongHopLe, "Các dòng dịch vụ phải cùng một ngày");

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    internal static string StatusLabel(AppointmentStatus status) => status switch
    {
        AppointmentStatus.ChoXacNhan => "Chờ xác nhận",
        AppointmentStatus.DaXacNhan => "Đã xác nhận",
        AppointmentStatus.DangPhucVu => "Đang phục vụ",
        AppointmentStatus.HoanThanh => "Đã hoàn thành",
        AppointmentStatus.DaHuy => "Đã hủy",
        _ => "Không đến"
    };
}
