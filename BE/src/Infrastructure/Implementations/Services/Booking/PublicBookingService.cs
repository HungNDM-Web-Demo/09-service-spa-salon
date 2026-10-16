using Application.Common.Exceptions;
using Application.Common.Time;
using Application.DTOs.Booking;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Validators.Booking;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.Services;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using Infrastructure.Implementations.Services.Crm;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Trang đặt lịch, tra cứu, khách tự hủy (UC-04, UC-06; 07 §3.3, §4.5; NFR-04, NFR-05).</summary>
public sealed class PublicBookingService(
    IGenericRepository<Service> services,
    IGenericRepository<StaffMember> staff,
    IGenericRepository<Customer> customers,
    IGenericRepository<Appointment> appointments,
    IBookingContext context,
    IUnitOfWork unitOfWork,
    IMemoryCache cache) : IPublicBookingService
{
    private const int LookupMaxFailures = 5;
    private static readonly TimeSpan LookupWindow = TimeSpan.FromMinutes(15);

    public async Task<PublicCatalogDto> GetCatalogAsync(CancellationToken ct = default)
    {
        var store = await context.GetStoreAsync(ct);
        var (open, close) = await context.GetHoursAsync(ct);
        var online = await OnlineServicesAsync(ct);
        var people = await staff.QueryNoTracking().Include(s => s.Services)
            .Where(s => s.IsActive && s.Kind == StaffKind.KyThuatVien)
            .ToListAsync(ct);
        var onlineIds = online.Select(s => s.Id).ToHashSet();
        return new PublicCatalogDto
        {
            Shop = new PublicShopDto(store.Name, store.Address, store.Hotline, store.LogoUrl),
            OpenTime = BookingRules.Hhmm(open),
            CloseTime = BookingRules.Hhmm(close),
            Groups = online
                // Nhóm theo khóa, không theo đối tượng Group: truy vấn không theo dõi tạo mỗi dịch vụ một bản Group riêng
                .GroupBy(s => s.GroupId)
                .Select(g => (Group: g.First().Group!, Items: g))
                .OrderBy(g => g.Group.SortOrder)
                .Select(g => new PublicGroupDto(g.Group.Id, g.Group.Name, g.Items
                    .OrderBy(s => s.Code, StringComparer.Ordinal)
                    .Select(s => new PublicServiceDto(s.Id, s.Code, s.Name, s.Description, s.ImageUrl, s.DurationMinutes, s.Price))
                    .ToList()))
                .ToList(),
            Technicians = people
                .Where(p => p.Services.Any(x => onlineIds.Contains(x.ServiceId)))
                .OrderBy(p => p.SortOrder).ThenBy(p => p.Code, StringComparer.Ordinal)
                .Select(p => new PublicTechnicianDto(p.Id, p.FullName, p.Specialty, p.Color,
                    p.Services.Select(x => x.ServiceId).Where(onlineIds.Contains).ToList()))
                .ToList()
        };
    }

    public async Task<PublicSlotsDto> GetSlotsAsync(PublicSlotsQuery query, CancellationToken ct = default)
    {
        var date = VietnamDates.TryParse(query.Date, out var d) ? d : context.Today;
        var ids = (query.ServiceIds ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => Guid.TryParse(x, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty)
            .Distinct()
            .Take(BookingRules.OnlineMaxServices)
            .ToList();
        var chosen = await ResolveServicesAsync(ids, ct);
        if (chosen.Count == 0 || date < context.Today || date > context.Today.AddDays(BookingRules.OnlineMaxDaysAhead))
            return new PublicSlotsDto { Date = date };

        var schedule = await context.LoadDayAsync(date, ct);
        var slots = ScheduleEngine.OnlineSlots(schedule, chosen, query.StaffMemberId, MinStart(date));
        DateOnly? next = null;
        if (slots.Count == 0)
        {
            for (var day = date.AddDays(1); day <= context.Today.AddDays(BookingRules.OnlineMaxDaysAhead); day = day.AddDays(1))
            {
                var other = await context.LoadDayAsync(day, ct);
                if (ScheduleEngine.OnlineSlots(other, chosen, query.StaffMemberId, MinStart(day)).Count > 0)
                {
                    next = day;
                    break;
                }
            }
        }

        return new PublicSlotsDto
        {
            Date = date,
            Slots = slots.Select(BookingRules.Hhmm).ToList(),
            NextAvailableDate = next,
            ClosedReason = schedule.ClosedReason
        };
    }

    public async Task<PublicAppointmentDto> BookAsync(PublicBookingRequest request, CancellationToken ct = default)
    {
        var id = await BookingGate.RunAsync(async () =>
        {
            var created = Guid.Empty;
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var chosen = await ResolveServicesAsync(request.ServiceIds, token);
                if (chosen.Count != request.ServiceIds.Count)
                    throw new FluentValidation.ValidationException([new FluentValidation.Results.ValidationFailure("serviceIds", "Dịch vụ không còn nhận đặt online")]);

                var (date, minute) = context.ToLocal(request.StartAt);
                var taken = BookingProblems.Conflict(BookingErrorCodes.GioDaCoNguoiDat, "Giờ này vừa có người đặt, vui lòng chọn giờ khác");
                if (date > context.Today.AddDays(BookingRules.OnlineMaxDaysAhead) || minute < MinStart(date) || minute % BookingRules.OnlineStepMinutes != 0)
                    throw taken;
                var schedule = await context.LoadDayAsync(date, token);
                var assignment = ScheduleEngine.AssignOnline(schedule, chosen, request.StaffMemberId, minute) ?? throw taken;

                var phone = BookingValidationRules.Digits(request.Phone!);
                var fullName = request.FullName!.Trim();
                var customer = await customers.Query().FirstOrDefaultAsync(c => c.Phone == phone, token);
                var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
                if (customer is not null)
                {
                    // BR-06: tối đa 2 lịch online chưa diễn ra đang chờ hoặc đã xác nhận.
                    var now = context.UtcNow;
                    var pending = await appointments.QueryNoTracking().CountAsync(a =>
                        a.CustomerId == customer.Id && a.Source == AppointmentSource.Online && a.StartAt > now
                        && (a.Status == AppointmentStatus.ChoXacNhan || a.Status == AppointmentStatus.DaXacNhan), token);
                    if (pending >= BookingRules.OnlineMaxPendingPerPhone)
                        throw BookingProblems.Domain(BookingErrorCodes.QuaSoLichCho, "Số điện thoại này đã có 2 lịch đang chờ, vui lòng gọi tiệm");

                    var draft = assignment.Select(a => new DraftLine(null, a.Service, a.StaffId, a.Start)).ToList();
                    var check = ScheduleEngine.CheckDraft(schedule, draft, null, customer.Id);
                    var clash = check.Issues.FirstOrDefault(i => i.Code == ScheduleEngine.Codes.TrungLichKhach);
                    if (clash is not null)
                        throw BookingProblems.Conflict(BookingErrorCodes.TrungLichKhach, clash.Message.Replace("Khách đã có lịch", "Bạn đã có lịch") + ", vui lòng chọn giờ khác");

                    if (!string.Equals(customer.FullName, fullName, StringComparison.OrdinalIgnoreCase))
                        note = string.IsNullOrEmpty(note) ? $"Tên khách nhập: {fullName}" : $"{note}. Tên khách nhập: {fullName}";
                }
                else
                {
                    customer = new Customer { Phone = phone, FullName = fullName, Code = await CustomerService.NextCodeAsync(customers, token) };
                    await customers.AddAsync(customer, token);
                }

                var appointment = new Appointment
                {
                    Code = await context.NextCodeAsync(BookingRules.AppointmentPrefix, context.Today, token),
                    CustomerId = customer.Id,
                    Source = AppointmentSource.Online,
                    Status = AppointmentStatus.ChoXacNhan,
                    Note = note,
                    CreatedByName = BookingRules.OnlineCreatorName
                };
                appointment.Lines = assignment.Select((a, i) =>
                {
                    var start = context.ToUtc(date, a.Start);
                    return new AppointmentLine
                    {
                        AppointmentId = appointment.Id,
                        ServiceId = a.Service.Id,
                        ServiceName = a.Service.Name,
                        Price = a.Service.Price,
                        DurationMinutes = a.Service.Duration,
                        CleanupMinutes = a.Service.Cleanup,
                        StaffMemberId = a.StaffId,
                        StartAt = start,
                        EndAt = start.AddMinutes(a.Service.Duration),
                        SortOrder = i + 1
                    };
                }).ToList();
                appointment.RefreshSpan(VietnamDates.DateOf);
                await appointments.AddAsync(appointment, token);
                await unitOfWork.SaveChangesAsync(token);
                created = appointment.Id;
            }, ct);
            return created;
        }, ct);
        return await ToPublicAsync(id, ct);
    }

    public async Task<PublicAppointmentDto> LookupAsync(PublicLookupRequest request, string? clientKey, CancellationToken ct = default)
    {
        var appointment = await FindAsync(request.Code, request.Phone, clientKey, ct);
        return await ToPublicAsync(appointment.Id, ct);
    }

    public async Task<PublicAppointmentDto> CancelAsync(PublicCancelRequest request, string? clientKey, CancellationToken ct = default)
    {
        var found = await FindAsync(request.Code, request.Phone, clientKey, ct);
        await BookingGate.RunAsync(async () =>
        {
            await unitOfWork.ExecuteInTransactionAsync(async token =>
            {
                var appointment = await appointments.Query().Include(a => a.Lines).Include(a => a.Messages).Include(a => a.Customer)
                    .FirstAsync(a => a.Id == found.Id, token);
                var store = await context.GetStoreAsync(token);
                if (!CanSelfCancel(appointment))
                    throw BookingProblems.InvalidState($"Lịch bắt đầu trong vòng 2 giờ hoặc đã xử lý, vui lòng gọi tiệm {store.Hotline}");
                appointment.Status = AppointmentStatus.DaHuy;
                appointment.CancelReason = CancelReason.KhachTuHuy;
                appointment.CancelNote = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
                appointment.CancelledAt = context.UtcNow;
                appointment.CancelledByName = appointment.Customer!.FullName;
                var (date, minute) = context.ToLocal(appointment.StartAt);
                appointment.Messages.Add(new AppointmentMessage
                {
                    AppointmentId = appointment.Id,
                    Kind = MessageKind.Huy,
                    Content = BookingMessages.Build(MessageKind.Huy, store.Name, appointment.Code, date, minute,
                        string.Join(", ", appointment.Lines.OrderBy(l => l.SortOrder).Select(l => l.ServiceName)),
                        appointment.Customer.FullName, appointment.Customer.Gender, appointment.CancelNote ?? BookingRules.CancelReasonLabel(CancelReason.KhachTuHuy)),
                    SentAt = context.UtcNow
                });
                await unitOfWork.SaveChangesAsync(token);
            }, ct);
            return true;
        }, ct);
        return await ToPublicAsync(found.Id, ct);
    }

    /// <summary>Mốc sớm nhất đặt được trong ngày: cách hiện tại ít nhất 2 giờ (BR-06).</summary>
    private int MinStart(DateOnly date)
    {
        var earliest = context.UtcNow.AddMinutes(BookingRules.OnlineMinLeadMinutes);
        return (int)Math.Ceiling((earliest - VietnamDates.StartOfDayUtc(date)).TotalMinutes);
    }

    /// <summary>Dịch vụ hiện trên trang đặt online (BR-06): đang hiện, nhóm đang hiện, cho đặt online, có KTV đang làm làm được.</summary>
    private async Task<List<Service>> OnlineServicesAsync(CancellationToken ct)
    {
        var withTechnician = await staff.QueryNoTracking()
            .Where(s => s.IsActive && s.Kind == StaffKind.KyThuatVien)
            .SelectMany(s => s.Services.Select(x => x.ServiceId))
            .Distinct()
            .ToListAsync(ct);
        return await services.QueryNoTracking().Include(s => s.Group)
            .Where(s => s.IsVisible && s.AllowOnline && s.Group!.IsVisible && withTechnician.Contains(s.Id))
            .ToListAsync(ct);
    }

    private async Task<List<ScheduleService>> ResolveServicesAsync(IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        var online = (await OnlineServicesAsync(ct)).ToDictionary(s => s.Id);
        return ids.Where(online.ContainsKey)
            .Select(id => online[id])
            .Select(s => new ScheduleService(s.Id, s.Name, s.DurationMinutes, s.CleanupMinutes, s.Price))
            .ToList();
    }

    private bool CanSelfCancel(Appointment a) =>
        a.Status is AppointmentStatus.ChoXacNhan or AppointmentStatus.DaXacNhan
        && a.StartAt - context.UtcNow >= TimeSpan.FromMinutes(BookingRules.SelfCancelMinLeadMinutes);

    /// <summary>Tìm lịch theo mã và số điện thoại; sai 5 lần trong 15 phút thì khóa 15 phút theo thiết bị (NFR-05).</summary>
    private async Task<Appointment> FindAsync(string? code, string? phone, string? clientKey, CancellationToken ct)
    {
        var key = $"spa:lookup:{clientKey ?? "unknown"}";
        var now = context.UtcNow;
        var state = cache.Get<LookupState>(key) ?? new LookupState();
        if (state.LockedUntil is { } until && until > now)
            throw new TooManyRequestsException("Bạn đã nhập sai 5 lần, vui lòng thử lại sau 15 phút", BookingErrorCodes.TamKhoaTraCuu,
                (int)Math.Ceiling((until - now).TotalSeconds));

        var normalizedCode = (code ?? string.Empty).Trim().ToUpperInvariant();
        var digits = BookingValidationRules.Digits(phone ?? string.Empty);
        var appointment = await appointments.QueryNoTracking().Include(a => a.Customer)
            .FirstOrDefaultAsync(a => a.Code == normalizedCode && a.Customer!.Phone == digits, ct);
        if (appointment is not null)
        {
            cache.Remove(key);
            return appointment;
        }

        state.Failures.RemoveAll(f => now - f > LookupWindow);
        state.Failures.Add(now);
        if (state.Failures.Count >= LookupMaxFailures)
        {
            state.LockedUntil = now + LookupWindow;
            state.Failures.Clear();
        }

        cache.Set(key, state, LookupWindow + TimeSpan.FromMinutes(1));
        throw new CodedNotFoundException("Không tìm thấy lịch hẹn với mã và số điện thoại này", "KhongTimThay");
    }

    private async Task<PublicAppointmentDto> ToPublicAsync(Guid id, CancellationToken ct)
    {
        var a = await appointments.QueryNoTracking().Include(x => x.Lines).Include(x => x.Customer).FirstAsync(x => x.Id == id, ct);
        var names = await staff.QueryNoTracking().ToDictionaryAsync(s => s.Id, s => s.FullName, ct);
        var store = await context.GetStoreAsync(ct);
        return new PublicAppointmentDto
        {
            Code = a.Code,
            Status = a.Status,
            Date = a.Date,
            StartAt = a.StartAt,
            EndAt = a.EndAt,
            Total = a.Lines.Sum(l => l.Price),
            PhoneMasked = BookingRules.MaskPhone(a.Customer!.Phone),
            CustomerName = a.Customer.FullName,
            CanCancel = CanSelfCancel(a),
            Hotline = store.Hotline,
            Lines = a.Lines.OrderBy(l => l.SortOrder)
                .Select(l => new PublicLineDto(l.ServiceName, names.GetValueOrDefault(l.StaffMemberId, string.Empty), l.StartAt, l.EndAt, l.Price))
                .ToList()
        };
    }

    private sealed class LookupState
    {
        public List<DateTime> Failures { get; } = [];
        public DateTime? LockedUntil { get; set; }
    }
}
