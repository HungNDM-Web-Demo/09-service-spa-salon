using Application.Common.Models;
using Application.Common.Time;
using Application.DTOs.Booking;
using Application.DTOs.Crm;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services.Booking;
using Application.Interfaces.Services.Common;
using Application.Interfaces.Services.Roles;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.BusinessHours;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.DaysOff;
using Domain.Entities.Hr.StaffMembers;
using Domain.Entities.System.Settings;
using Domain.Entities.System.Users;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Hỗ trợ chung của nghiệp vụ Spa trong một request (xem <see cref="IBookingContext"/>).</summary>
public sealed class BookingContext(
    TimeProvider timeProvider,
    ICurrentUserService currentUser,
    IPermissionService permissions,
    IGenericRepository<User> users,
    IGenericRepository<Setting> settings,
    IGenericRepository<BusinessHours> hours,
    IGenericRepository<StaffMember> staff,
    IGenericRepository<DayOff> daysOff,
    IGenericRepository<Appointment> appointments,
    IGenericRepository<AppointmentLine> lines,
    IGenericRepository<Invoice> invoices,
    IGenericRepository<CustomerPackage> packages,
    IGenericRepository<PackageUsage> usages,
    IGenericRepository<Customer> customers) : IBookingContext
{
    private readonly Dictionary<string, int> _reserved = new(StringComparer.Ordinal);
    private DateTime? _now;
    private BookingActor? _actor;
    private (int Open, int Close)? _hours;
    private StoreInfo? _store;

    public DateTime UtcNow
    {
        get
        {
            if (_now is null)
            {
                var now = timeProvider.GetUtcNow().UtcDateTime;
                _now = DateTime.SpecifyKind(new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerSecond), DateTimeKind.Utc);
            }

            return _now.Value;
        }
    }

    public DateOnly Today => VietnamDates.DateOf(UtcNow);

    public int NowMinute => ToLocal(UtcNow).Minute;

    public DateTime ToUtc(DateOnly date, int minute) => VietnamDates.StartOfDayUtc(date).AddMinutes(minute);

    public (DateOnly Date, int Minute) ToLocal(DateTime utc)
    {
        var date = VietnamDates.DateOf(utc);
        return (date, (int)Math.Floor((DateTime.SpecifyKind(utc, DateTimeKind.Utc) - VietnamDates.StartOfDayUtc(date)).TotalMinutes));
    }

    public async Task<BookingActor> GetActorAsync(CancellationToken ct = default)
    {
        if (_actor is not null)
            return _actor;

        if (currentUser.UserId is not { } userId)
            return _actor = new BookingActor(null, BookingRules.SystemActorName, UserAccess.None);

        var name = await users.QueryNoTracking().Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct);
        var access = await permissions.GetUserAccessAsync(userId, ct);
        return _actor = new BookingActor(userId, name ?? currentUser.Username ?? BookingRules.SystemActorName, access);
    }

    public async Task<(int Open, int Close)> GetHoursAsync(CancellationToken ct = default)
    {
        if (_hours is not null)
            return _hours.Value;
        var row = await hours.QueryNoTracking().OrderBy(h => h.CreatedAt).FirstOrDefaultAsync(ct);
        _hours = row is null ? (BookingRules.DefaultOpenMinute, BookingRules.DefaultCloseMinute) : (row.OpenMinute, row.CloseMinute);
        return _hours.Value;
    }

    public async Task<DaySchedule> LoadDayAsync(DateOnly date, CancellationToken ct = default)
    {
        var (open, close) = await GetHoursAsync(ct);
        var offs = await daysOff.QueryNoTracking().Where(d => d.Date == date).ToListAsync(ct);
        var closed = offs.FirstOrDefault(d => d.StaffMemberId == null);
        var isoDay = BookingRules.IsoDayOfWeek(date);

        var people = await staff.QueryNoTracking()
            .Include(s => s.Services)
            .Include(s => s.Shifts)
            .Where(s => s.Kind == StaffKind.KyThuatVien)
            .ToListAsync(ct);
        var scheduleStaff = people
            .Select(s => new ScheduleStaff(
                s.Id,
                s.Code,
                s.FullName,
                s.IsActive,
                true,
                s.ShiftOn(isoDay),
                offs.FirstOrDefault(d => d.StaffMemberId == s.Id)?.Reason,
                s.Services.Select(x => x.ServiceId).ToHashSet(),
                s.SortOrder))
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Code, StringComparer.Ordinal)
            .ToList();

        var dayStart = VietnamDates.StartOfDayUtc(date);
        var occupying = await lines.QueryNoTracking()
            .Where(l => l.Appointment!.Date == date
                        && (l.Appointment.Status == AppointmentStatus.ChoXacNhan || l.Appointment.Status == AppointmentStatus.DaXacNhan
                            || l.Appointment.Status == AppointmentStatus.DangPhucVu || l.Appointment.Status == AppointmentStatus.HoanThanh))
            .Select(l => new { l.Id, l.AppointmentId, l.StaffMemberId, l.StartAt, l.EndAt, l.CleanupMinutes })
            .ToListAsync(ct);
        var busy = occupying
            .Select(l => new BusyLine(l.Id, l.AppointmentId, l.StaffMemberId, Minutes(dayStart, l.StartAt), Minutes(dayStart, l.EndAt), l.CleanupMinutes))
            .ToList();

        var spans = await appointments.QueryNoTracking()
            .Where(a => a.Date == date
                        && (a.Status == AppointmentStatus.ChoXacNhan || a.Status == AppointmentStatus.DaXacNhan
                            || a.Status == AppointmentStatus.DangPhucVu || a.Status == AppointmentStatus.HoanThanh))
            .Select(a => new { a.Id, a.CustomerId, a.Code, a.StartAt, a.EndAt })
            .ToListAsync(ct);

        return new DaySchedule
        {
            Date = date,
            Today = Today,
            NowMinute = NowMinute,
            Open = open,
            Close = close,
            ClosedReason = closed?.Reason,
            Staff = scheduleStaff,
            Busy = busy,
            CustomerSpans = spans.Select(a => new CustomerSpan(a.Id, a.CustomerId, a.Code, Minutes(dayStart, a.StartAt), Minutes(dayStart, a.EndAt))).ToList()
        };
    }

    public async Task<string> NextCodeAsync(string prefix, DateOnly date, CancellationToken ct = default)
    {
        var stem = BookingRules.DocStem(prefix, date);
        if (!_reserved.TryGetValue(stem, out var last))
        {
            IQueryable<string> codes = prefix switch
            {
                BookingRules.AppointmentPrefix => appointments.QueryNoTracking().Select(a => a.Code),
                BookingRules.InvoicePrefix => invoices.QueryNoTracking().Select(i => i.Code),
                BookingRules.PackagePrefix => packages.QueryNoTracking().Select(p => p.Code),
                _ => throw new ArgumentOutOfRangeException(nameof(prefix), prefix, "Tiền tố mã chứng từ không hợp lệ.")
            };
            var existing = await codes.Where(c => c.StartsWith(stem)).ToListAsync(ct);
            last = existing.Select(c => int.TryParse(c.AsSpan(stem.Length), out var n) ? n : 0).DefaultIfEmpty(0).Max();
        }

        _reserved[stem] = last + 1;
        return BookingRules.DocCode(prefix, date, last + 1);
    }

    public async Task<StoreInfo> GetStoreAsync(CancellationToken ct = default)
    {
        if (_store is not null)
            return _store;
        var map = await settings.QueryNoTracking()
            .Where(s => s.Key.StartsWith("Store.") || s.Key.StartsWith("Brand.") || s.Key.StartsWith("Company."))
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        string Get(string key, string fallback = "") => map.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : fallback;
        return _store = new StoreInfo(
            Get("Store.Name", Get("Brand.AppName", "Spa")),
            Get("Store.Address"),
            Get("Store.Hotline", Get("Company.Hotline")),
            map.GetValueOrDefault("Brand.LogoUrl"),
            Get("Store.BankBin"),
            Get("Store.BankAccount"),
            Get("Store.BankAccountName"));
    }

    public async Task<IReadOnlyDictionary<Guid, int>> NoShowCountsAsync(IReadOnlyCollection<Guid> customerIds, CancellationToken ct = default)
    {
        if (customerIds.Count == 0)
            return new Dictionary<Guid, int>();
        var since = Today.AddDays(-BookingRules.NoShowWindowDays);
        var ids = customerIds.Distinct().ToList();
        var rows = await appointments.QueryNoTracking()
            .Where(a => ids.Contains(a.CustomerId) && a.Status == AppointmentStatus.KhongDen && a.Date >= since)
            .GroupBy(a => a.CustomerId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Key, r => r.Count);
    }

    public async Task<CustomerDto> GetCustomerDtoAsync(Guid customerId, CancellationToken ct = default)
    {
        var customer = await customers.QueryNoTracking().FirstOrDefaultAsync(c => c.Id == customerId, ct)
                       ?? throw new Application.Common.Exceptions.NotFoundException("Không tìm thấy khách.");
        var stats = await CustomerStats.LoadAsync(appointments, invoices, packages, [customerId], Today, ct);
        return CustomerStats.ToDto(customer, stats.GetValueOrDefault(customerId));
    }

    public async Task<IReadOnlyList<CustomerPackageBrief>> GetCustomerPackagesAsync(
        Guid customerId, IReadOnlyCollection<Guid>? serviceIds, CancellationToken ct = default)
    {
        var query = packages.QueryNoTracking().Where(p => p.CustomerId == customerId);
        if (serviceIds is { Count: > 0 })
        {
            var ids = serviceIds.ToList();
            query = query.Where(p => ids.Contains(p.ServiceId));
        }

        var list = await query.OrderBy(p => p.ExpiryDate).ThenBy(p => p.Code).ToListAsync(ct);
        var packageIds = list.Select(p => p.Id).ToList();
        var lastUsed = await usages.QueryNoTracking()
            .Where(u => packageIds.Contains(u.CustomerPackageId) && !u.Refunded)
            .GroupBy(u => u.CustomerPackageId)
            .Select(g => new { g.Key, Last = g.Max(u => u.UsedAt) })
            .ToListAsync(ct);
        var lastMap = lastUsed.ToDictionary(x => x.Key, x => x.Last);
        return list.Select(p => p.ToBrief(lastMap.TryGetValue(p.Id, out var at) ? at : null)).ToList();
    }

    private static int Minutes(DateTime dayStartUtc, DateTime utc) =>
        (int)Math.Round((DateTime.SpecifyKind(utc, DateTimeKind.Utc) - dayStartUtc).TotalMinutes);
}

/// <summary>Chỉ số khách tính khi đọc (06 §4 <c>Crm_Customers</c>).</summary>
internal static class CustomerStats
{
    internal sealed record Stats(int NoShow90, decimal TotalSpent, int VisitCount, DateTime? LastVisitAt, int ActivePackages);

    public static async Task<Dictionary<Guid, Stats>> LoadAsync(
        IGenericRepository<Appointment> appointments,
        IGenericRepository<Invoice> invoices,
        IGenericRepository<CustomerPackage> packages,
        IReadOnlyCollection<Guid> customerIds,
        DateOnly today,
        CancellationToken ct)
    {
        var ids = customerIds.Distinct().ToList();
        var since = today.AddDays(-BookingRules.NoShowWindowDays);
        var noShow = await appointments.QueryNoTracking()
            .Where(a => ids.Contains(a.CustomerId) && a.Status == AppointmentStatus.KhongDen && a.Date >= since)
            .GroupBy(a => a.CustomerId).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var visits = await appointments.QueryNoTracking()
            .Where(a => ids.Contains(a.CustomerId) && a.Status == AppointmentStatus.HoanThanh)
            .GroupBy(a => a.CustomerId).Select(g => new { g.Key, Count = g.Count(), Last = g.Max(a => a.StartAt) }).ToListAsync(ct);
        var spent = await invoices.QueryNoTracking()
            .Where(i => ids.Contains(i.CustomerId) && i.Status == InvoiceStatus.DaThanhToan)
            .Select(i => new { i.CustomerId, i.Total })
            .ToListAsync(ct);
        var active = await packages.QueryNoTracking()
            .Where(p => ids.Contains(p.CustomerId) && p.Status == CustomerPackageStatus.DangDung)
            .GroupBy(p => p.CustomerId).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);

        return ids.ToDictionary(id => id, id => new Stats(
            noShow.FirstOrDefault(x => x.Key == id)?.Count ?? 0,
            spent.Where(x => x.CustomerId == id).Sum(x => x.Total),
            visits.FirstOrDefault(x => x.Key == id)?.Count ?? 0,
            visits.FirstOrDefault(x => x.Key == id)?.Last,
            active.FirstOrDefault(x => x.Key == id)?.Count ?? 0));
    }

    public static CustomerDto ToDto(Customer c, Stats? stats) => new()
    {
        Id = c.Id,
        Code = c.Code,
        Phone = c.Phone,
        FullName = c.FullName,
        BirthDate = c.BirthDate,
        Gender = c.Gender,
        Note = c.Note,
        CreatedAt = c.CreatedAt,
        NoShowCount90 = stats?.NoShow90 ?? 0,
        IsFlagged = (stats?.NoShow90 ?? 0) >= BookingRules.NoShowFlagThreshold,
        TotalSpent = stats?.TotalSpent ?? 0,
        VisitCount = stats?.VisitCount ?? 0,
        LastVisitAt = stats?.LastVisitAt,
        ActivePackageCount = stats?.ActivePackages ?? 0
    };
}

internal static class CustomerPackageMappings
{
    public static CustomerPackageBrief ToBrief(this CustomerPackage p, DateTime? lastUsedAt) => new()
    {
        Id = p.Id,
        Code = p.Code,
        PackageName = p.PackageName,
        ServiceId = p.ServiceId,
        ServiceName = p.ServiceName,
        TotalSessions = p.TotalSessions,
        Remaining = p.Remaining,
        ExpiryDate = p.ExpiryDate,
        Status = p.Status,
        SessionValue = p.SessionValue,
        MinIntervalDays = p.MinIntervalDays,
        LastUsedAt = lastUsedAt,
        PurchasedAt = p.PurchasedAt
    };
}
