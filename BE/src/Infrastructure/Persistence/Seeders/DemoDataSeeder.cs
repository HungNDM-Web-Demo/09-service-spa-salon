using System.Text.Json;
using Application.Common.Time;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.BusinessHours;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.PackageTemplates;
using Domain.Entities.Booking.Services;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.Commissions;
using Domain.Entities.Hr.DaysOff;
using Domain.Entities.Hr.StaffMembers;
using Domain.Entities.System.Settings;
using Domain.Entities.System.Users;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using Infrastructure.Implementations.Services.Booking;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Seeders;

/// <summary>
/// Dữ liệu nghiệp vụ mẫu Spa từ <c>FE/src/mock/seed/demo-data.json</c> (06 §5). Danh mục nạp thẳng; ngày giờ, trạng thái lịch
/// suy theo lúc nạp (06 §5.3, §5.4); thanh toán và bán gói chạy lại theo thời gian bằng chính <see cref="InvoiceBuilder"/>
/// (06 §5.5) để gói, lần trừ buổi, hoa hồng ra đúng như khi lễ tân thao tác. FE <c>features/booking/mock/seed-loader.ts</c>
/// làm giống hệt.
/// </summary>
public sealed class DemoDataSeeder(AppDbContext db, TimeProvider timeProvider) : IDemoDataSeeder
{
    public const string FileName = "demo-data.json";
    private const string Receptionist = "nhanvien";

    public Task<bool> HasDataAsync(CancellationToken ct = default) => db.Set<ServiceGroup>().AnyAsync(ct);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var seed = SeedJson.Read<SpaSeedFile>(FileName, timeProvider);
        var clock = new SpaSeedClock(timeProvider.GetUtcNow().UtcDateTime);
        var users = await db.Set<User>().IgnoreQueryFilters().ToDictionaryAsync(u => u.Username, StringComparer.OrdinalIgnoreCase, ct);
        string NameOf(string username) => users.TryGetValue(username, out var u) ? u.FullName : username;
        var storeName = await db.Set<Setting>().Where(s => s.Key == "Store.Name").Select(s => s.Value).FirstOrDefaultAsync(ct) ?? "Spa";

        // 1) Danh mục, nhân viên, khách (06 §5.5 bước 1).
        var groups = seed.ServiceGroups.Select((g, i) => (g.Code, Entity: new ServiceGroup { Name = g.Name, IsVisible = g.Visible ?? true, SortOrder = (i + 1) * 10 }))
            .ToDictionary(x => x.Code, x => x.Entity);
        var services = seed.Services.ToDictionary(s => s.Code, s => new Service
        {
            Code = s.Code,
            Name = s.Name,
            GroupId = groups[s.Group].Id,
            Group = groups[s.Group],
            DurationMinutes = s.Dur,
            CleanupMinutes = s.Clean,
            Price = s.Price,
            Description = s.Desc,
            ImageUrl = s.Img is null ? null : $"/seed/services/{s.Img}.webp",
            AllowOnline = s.Online,
            CommissionType = s.Ct,
            CommissionValue = s.Cv,
            IsVisible = s.Visible ?? true
        });
        var templates = seed.PackageTemplates.ToDictionary(t => t.Code, t => new PackageTemplate
        {
            Code = t.Code,
            Name = t.Name,
            ServiceId = services[t.Service].Id,
            Service = services[t.Service],
            Sessions = t.Sessions,
            Price = t.Price,
            ValidityMonths = t.Months,
            MinIntervalDays = t.Gap,
            CommissionRate = t.Rate,
            IsActive = t.Active ?? true
        });
        var staff = seed.Staff.Select((s, i) =>
        {
            var member = new StaffMember
            {
                Code = s.Code,
                FullName = s.Name,
                Phone = s.Phone,
                Kind = s.Kind,
                Color = s.Color,
                Specialty = s.Specialty,
                UserId = s.User is not null && users.TryGetValue(s.User, out var u) ? u.Id : null,
                IsActive = true,
                SortOrder = (i + 1) * 10
            };
            if (s.Kind == StaffKind.KyThuatVien)
            {
                member.Services = s.Services.Select(code => new StaffService { StaffMemberId = member.Id, ServiceId = services[code].Id }).ToList();
                member.Shifts = Enumerable.Range(1, 7).Select(day => new WeeklyShift { StaffMemberId = member.Id, DayOfWeek = day, Shift = SpaSeedClock.Shift(s.Week[day - 1]) }).ToList();
            }

            return member;
        }).ToDictionary(m => m.Code);
        var daysOff = seed.DaysOff.Select(d => new DayOff
        {
            StaffMemberId = d.Staff is null ? null : staff[d.Staff].Id,
            Date = clock.DayOf(d),
            Reason = d.Reason
        }).ToList();
        var customers = seed.Customers.ToDictionary(c => c.Code, c =>
        {
            var customer = new Customer { Code = c.Code, FullName = c.Name, Phone = c.Phone, Gender = c.G, BirthDate = c.Birth, Note = c.Note };
            customer.SetCreatedAt(clock.CustomerCreatedAt(c.Cr));
            return customer;
        });

        // 2) Lịch hẹn: suy ngày giờ, cửa sổ 90/14 ngày, bỏ lịch vướng kịch bản kiểm thử (06 §5.5 bước 2).
        var resolved = new List<ResolvedAppointment>();
        for (var i = 0; i < seed.Appointments.Count; i++)
        {
            var a = seed.Appointments[i];
            var date = clock.DayOf(a);
            var fx = a.Fx == true;
            if (!fx && (date < clock.Today.AddDays(-90) || date > clock.Today.AddDays(14)))
                continue;
            var lines = a.Ln.Select(l =>
            {
                var service = services[l[0]];
                var start = clock.StartMinute(l[2], service.DurationMinutes);
                return new ResolvedLine(service, staff[l[1]], start, clock.ToUtc(date, start));
            }).ToList();
            resolved.Add(new ResolvedAppointment(i, a, date, lines, fx));
        }

        var fixtures = resolved.Where(r => r.Fixture).ToList();
        var kept = resolved.Where(r => r.Fixture || !Dropped(r, fixtures, seed.Reserve, clock)).ToList();

        // 3) Thực thể lịch hẹn, mã theo ngày tạo (06 §5.4, §5.5 bước 3).
        var receptionistName = NameOf(Receptionist);
        var appointments = new List<(ResolvedAppointment Source, Appointment Entity)>();
        foreach (var r in kept)
        {
            var a = r.Seed;
            var start = r.Lines.Min(l => l.StartUtc);
            var end = r.Lines.Max(l => l.StartUtc.AddMinutes(l.Service.DurationMinutes));
            var created = clock.CreatedAt(a.Cr, a.Ld, start);
            var status = a.St ?? clock.Status(a.O ?? "done", a.Src, r.Date, start, end);
            var appointment = new Appointment
            {
                CustomerId = customers[a.C].Id,
                Customer = customers[a.C],
                Source = a.Src,
                Status = status,
                Note = a.Nt,
                CreatedByName = a.Src == AppointmentSource.Online ? BookingRules.OnlineCreatorName : receptionistName
            };
            appointment.SetCreatedAt(created);
            appointment.Lines = r.Lines.Select((l, i) => new AppointmentLine
            {
                AppointmentId = appointment.Id,
                ServiceId = l.Service.Id,
                ServiceName = l.Service.Name,
                Price = l.Service.Price,
                DurationMinutes = l.Service.DurationMinutes,
                CleanupMinutes = l.Service.CleanupMinutes,
                StaffMemberId = l.Staff.Id,
                StartAt = l.StartUtc,
                EndAt = l.StartUtc.AddMinutes(l.Service.DurationMinutes),
                SortOrder = i + 1
            }).ToList();
            appointment.RefreshSpan(VietnamDates.DateOf);
            ApplyTimeline(appointment, a, created, clock, receptionistName);
            appointments.Add((r, appointment));
        }

        var counters = new Dictionary<string, int>(StringComparer.Ordinal);
        string NextCode(string prefix, DateOnly date)
        {
            var stem = BookingRules.DocStem(prefix, date);
            counters[stem] = counters.GetValueOrDefault(stem) + 1;
            return BookingRules.DocCode(prefix, date, counters[stem]);
        }

        foreach (var (_, entity) in appointments.OrderBy(x => x.Entity.CreatedAt).ThenBy(x => x.Source.Index))
            entity.Code = NextCode(BookingRules.AppointmentPrefix, VietnamDates.DateOf(entity.CreatedAt));

        // 4) Sự kiện tiền theo thời gian (06 §5.5 bước 4).
        var events = new List<(DateTime At, int Kind, int Index, Action Run)>();
        var ownedPackages = new Dictionary<Guid, List<CustomerPackage>>();
        var allPackages = new List<CustomerPackage>();
        var usages = new List<PackageUsage>();
        var invoices = new List<Invoice>();
        var commissions = new List<Commission>();

        List<CustomerPackage> PackagesOf(Guid customerId) =>
            ownedPackages.TryGetValue(customerId, out var list) ? list : ownedPackages[customerId] = [];
        DateOnly? LastUsed(Guid packageId) =>
            usages.Where(u => u.CustomerPackageId == packageId && !u.Refunded).Select(u => (DateTime?)u.UsedAt).Max() is { } at ? VietnamDates.DateOf(at) : null;

        void Record(CheckoutOutcome outcome, Customer customer)
        {
            invoices.Add(outcome.Invoice);
            PackagesOf(customer.Id).AddRange(outcome.NewPackages);
            allPackages.AddRange(outcome.NewPackages);
            usages.AddRange(outcome.Usages);
            commissions.AddRange(outcome.Commissions);
        }

        for (var i = 0; i < seed.PackageSales.Count; i++)
        {
            var sale = seed.PackageSales[i];
            var at = clock.ToUtc(clock.DayOf(sale), SpaSeedClock.ParseMinute(sale.T));
            if (at > clock.Now)
                continue;
            var index = i;
            events.Add((at, 0, i, () =>
            {
                var customer = customers[sale.C];
                var template = templates[sale.Tpl];
                var consultant = staff[sale.By];
                var draft = new CheckoutDraft
                {
                    Customer = customer,
                    LastUsedDate = _ => null,
                    Sales = [new CheckoutSaleSource(template, template.Service!.Name, consultant.Id, consultant.FullName)],
                    DiscountLimitPercent = BookingRules.ManagerDiscountLimitPercent,
                    Method = sale.M,
                    Now = at,
                    CashierName = receptionistName
                };
                var outcome = Checkout(draft, index + 5000, NextCode);
                if (sale.Exp is { } exp)
                {
                    var package = outcome.NewPackages[0];
                    package.ExpiryDate = clock.Today.AddDays(exp);
                    foreach (var line in outcome.Invoice.Lines.Where(l => l.CustomerPackageId == package.Id))
                        line.PackageExpiryDate = package.ExpiryDate;
                }

                Record(outcome, customer);
            }));
        }

        foreach (var (source, appointment) in appointments.Where(x => x.Entity.Status == AppointmentStatus.HoanThanh))
        {
            var paidAt = appointment.CompletedAt!.Value;
            var pay = source.Seed.Pay ?? new SeedPay { M = PaymentMethod.TienMat };
            events.Add((paidAt, 1, source.Index, () =>
            {
                var customer = customers[source.Seed.C];
                var sales = (pay.Sell ?? []).Select(s =>
                {
                    var template = templates[s[0]];
                    var consultant = staff[s[1]];
                    return new CheckoutSaleSource(template, template.Service!.Name, consultant.Id, consultant.FullName);
                }).ToList();
                var relevant = appointment.Lines.Select(l => l.ServiceId).Concat(sales.Select(s => s.Template.ServiceId)).ToHashSet();
                var draft = new CheckoutDraft
                {
                    Appointment = appointment,
                    Customer = customer,
                    Lines = appointment.Lines.OrderBy(l => l.SortOrder).Select(l =>
                    {
                        var service = services.Values.First(s => s.Id == l.ServiceId);
                        return new CheckoutLineSource(l, staff.Values.First(s => s.Id == l.StaffMemberId).FullName, service.CommissionType, service.CommissionValue);
                    }).ToList(),
                    Packages = PackagesOf(customer.Id).Where(p => relevant.Contains(p.ServiceId)).ToList(),
                    LastUsedDate = LastUsed,
                    Sales = sales,
                    Discount = Discount(pay.Disc),
                    DiscountLimitPercent = BookingRules.ManagerDiscountLimitPercent,
                    Method = pay.M,
                    OverrideReason = pay.Ovr,
                    Now = paidAt,
                    CashierName = NameOf(pay.By ?? Receptionist)
                };
                Record(Checkout(draft, source.Index, NextCode), customer);
            }));
        }

        foreach (var (_, _, _, run) in events.OrderBy(e => e.At).ThenBy(e => e.Kind).ThenBy(e => e.Index))
            run();

        // 5) Gói quá hạn còn buổi (06 §5.5 bước 5).
        foreach (var package in allPackages.Where(p => p.Status == CustomerPackageStatus.DangDung && p.ExpiryDate < clock.Today && p.Remaining > 0))
            package.Status = CustomerPackageStatus.HetHan;

        // 6) Bảng hoa hồng tháng (06 §5.5 bước 6).
        var currentMonth = BookingRules.MonthKey(clock.Today);
        var periods = commissions.Select(c => c.Month).Distinct().Order().Select(month =>
        {
            var age = MonthsBetween(month, currentMonth);
            var nextMonth = BookingRules.MonthStart(month).AddMonths(1);
            var period = new CommissionPeriod { Month = month, Code = BookingRules.CommissionPeriodCode(month) };
            if (age >= 2)
            {
                period.Status = age >= 3 ? CommissionPeriodStatus.DaChiTra : CommissionPeriodStatus.DaChot;
                period.ClosedAt = clock.ToUtc(nextMonth, 9 * 60);
                period.ClosedByName = NameOf("quanly");
                if (age >= 3)
                {
                    period.PaidAt = clock.ToUtc(nextMonth.AddDays(4), 10 * 60);
                    period.PaidByName = NameOf("quanly");
                }
            }

            return period;
        }).ToList();

        // 7) Tin xác nhận của lịch sắp tới (06 §5.5 bước 7).
        foreach (var (_, appointment) in appointments.Where(x => x.Entity.Status == AppointmentStatus.DaXacNhan && x.Entity.Date >= clock.Today))
        {
            var customer = appointment.Customer!;
            var (date, minute) = (appointment.Date, SpaSeedClock.MinuteOf(appointment.StartAt));
            appointment.Messages.Add(new AppointmentMessage
            {
                AppointmentId = appointment.Id,
                Kind = MessageKind.XacNhan,
                Channel = MessageChannel.Zalo,
                Content = BookingMessages.Build(MessageKind.XacNhan, storeName, appointment.Code, date, minute,
                    string.Join(", ", appointment.Lines.OrderBy(l => l.SortOrder).Select(l => l.ServiceName)), customer.FullName, customer.Gender),
                SentAt = appointment.ConfirmedAt ?? appointment.CreatedAt
            });
        }

        // Tắt dò thay đổi tự động khi thêm hàng nghìn bản ghi (interceptor gọi DetectChanges một lần lúc lưu).
        var autoDetect = db.ChangeTracker.AutoDetectChangesEnabled;
        db.ChangeTracker.AutoDetectChangesEnabled = false;
        db.Set<BusinessHours>().Add(new BusinessHours());
        db.AddRange(groups.Values);
        db.AddRange(services.Values);
        db.AddRange(templates.Values);
        db.AddRange(staff.Values);
        db.AddRange(daysOff);
        db.AddRange(customers.Values);
        db.AddRange(appointments.Select(x => x.Entity));
        db.AddRange(invoices);
        db.AddRange(allPackages);
        db.AddRange(usages);
        db.AddRange(commissions);
        db.AddRange(periods);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        finally
        {
            db.ChangeTracker.AutoDetectChangesEnabled = autoDetect;
        }

    }

    public async Task ClearAsync(CancellationToken ct = default)
    {
        await db.Set<Commission>().ExecuteDeleteAsync(ct);
        await db.Set<CommissionPeriod>().ExecuteDeleteAsync(ct);
        await db.Set<PackageUsage>().ExecuteDeleteAsync(ct);
        await db.Set<InvoiceLine>().ExecuteDeleteAsync(ct);
        await db.Set<CustomerPackage>().ExecuteDeleteAsync(ct);
        await db.Set<Invoice>().ExecuteDeleteAsync(ct);
        await db.Set<AppointmentMessage>().ExecuteDeleteAsync(ct);
        await db.Set<AppointmentLine>().ExecuteDeleteAsync(ct);
        await db.Set<Appointment>().ExecuteDeleteAsync(ct);
        await db.Set<Customer>().ExecuteDeleteAsync(ct);
        await db.Set<DayOff>().ExecuteDeleteAsync(ct);
        await db.Set<StaffService>().ExecuteDeleteAsync(ct);
        await db.Set<WeeklyShift>().ExecuteDeleteAsync(ct);
        await db.Set<StaffMember>().ExecuteDeleteAsync(ct);
        await db.Set<PackageTemplate>().ExecuteDeleteAsync(ct);
        await db.Set<Service>().ExecuteDeleteAsync(ct);
        await db.Set<ServiceGroup>().ExecuteDeleteAsync(ct);
        await db.Set<BusinessHours>().ExecuteDeleteAsync(ct);
    }

    /// <summary>Thanh toán một sự kiện: lý do BR-19 thiếu thì dòng đó trả lẻ; giảm giá lỗi thì bỏ giảm (06 §5.4).</summary>
    private static CheckoutOutcome Checkout(CheckoutDraft draft, int index, Func<string, DateOnly, string> nextCode)
    {
        var result = InvoiceBuilder.Compute(draft);
        if (result.Errors.Count > 0 && draft.Discount is not null)
        {
            draft = Clone(draft, draft.UsePackage, discount: null);
            result = InvoiceBuilder.Compute(draft);
        }

        for (var attempt = 0; attempt < 5 && result.RequiresOverrideReason && string.IsNullOrWhiteSpace(draft.OverrideReason); attempt++)
        {
            // Dòng trừ buổi chưa đủ khoảng cách mà không có lý do thì trả lẻ; dòng khác giữ đúng quyết định vừa tính.
            var retail = result.Lines.Where(l => l.UsesPackage && l.IntervalWarning is not null).Select(l => l.Line.LineId).ToHashSet();
            var map = result.Lines.ToDictionary(l => l.Line.LineId, l => l.UsesPackage && !retail.Contains(l.Line.LineId));
            draft = Clone(draft, map, draft.Discount);
            result = InvoiceBuilder.Compute(draft);
        }

        var total = result.Total;
        var payDate = VietnamDates.DateOf(draft.Now);
        draft = new CheckoutDraft
        {
            Appointment = draft.Appointment,
            Customer = draft.Customer,
            Lines = draft.Lines,
            UsePackage = draft.UsePackage,
            Packages = draft.Packages,
            LastUsedDate = draft.LastUsedDate,
            Sales = draft.Sales,
            Discount = draft.Discount,
            DiscountLimitPercent = draft.DiscountLimitPercent,
            Method = draft.Method,
            CashReceived = draft.Method == PaymentMethod.TienMat ? Math.Ceiling(total / 50000m) * 50000m : null,
            CardAuthCode = draft.Method == PaymentMethod.The ? ((index * 7919 + 104729) % 900000 + 100000).ToString() : null,
            OverrideReason = draft.OverrideReason,
            Now = draft.Now,
            CashierName = draft.CashierName
        };
        return InvoiceBuilder.Apply(draft, result, prefix => nextCode(prefix, payDate));
    }

    private static CheckoutDraft Clone(CheckoutDraft d, IReadOnlyDictionary<Guid, bool>? usePackage, CheckoutDiscount? discount) => new()
    {
        Appointment = d.Appointment,
        Customer = d.Customer,
        Lines = d.Lines,
        UsePackage = usePackage,
        Packages = d.Packages,
        LastUsedDate = d.LastUsedDate,
        Sales = d.Sales,
        Discount = discount,
        DiscountLimitPercent = d.DiscountLimitPercent,
        Method = d.Method,
        OverrideReason = d.OverrideReason,
        Now = d.Now,
        CashierName = d.CashierName
    };

    private static CheckoutDiscount? Discount(List<JsonElement>? raw)
    {
        if (raw is not { Count: >= 2 })
            return null;
        var type = Enum.Parse<DiscountType>(raw[0].GetString()!);
        return new CheckoutDiscount(type, raw[1].GetDecimal(), raw.Count > 2 ? raw[2].GetString() : null);
    }

    /// <summary>Mốc thời gian theo trạng thái (06 §5.4).</summary>
    private static void ApplyTimeline(Appointment a, SeedAppointment seed, DateTime created, SpaSeedClock clock, string receptionist)
    {
        var start = a.StartAt;
        var end = a.EndAt;
        var online = a.Source == AppointmentSource.Online;
        if (a.Status is AppointmentStatus.DaXacNhan or AppointmentStatus.DangPhucVu or AppointmentStatus.HoanThanh or AppointmentStatus.KhongDen)
        {
            a.ConfirmedAt = online ? Min(created.AddMinutes(15), clock.Now) : created;
            a.ConfirmedByName = receptionist;
        }

        if (a.Status is AppointmentStatus.DangPhucVu or AppointmentStatus.HoanThanh)
        {
            a.CheckedInAt = start.AddMinutes(-5);
            a.CheckedInByName = receptionist;
        }

        if (a.Status == AppointmentStatus.HoanThanh)
            a.CompletedAt = Min(end.AddMinutes(5), clock.Now);

        if (a.Status == AppointmentStatus.KhongDen)
        {
            a.NoShowAt = start.AddMinutes(20);
            a.NoShowByName = receptionist;
        }

        if (a.Status == AppointmentStatus.DaHuy)
        {
            var reason = seed.Cx is { Count: > 0 } cx ? Enum.Parse<CancelReason>(cx[0]) : CancelReason.KhachBaoHuy;
            a.CancelReason = reason;
            a.CancelNote = seed.Cx is { Count: > 1 } cx2 ? cx2[1] : null;
            var at = Min(start.AddMinutes(-60), created.AddMinutes(30));
            a.CancelledAt = Min(at < created ? created : at, clock.Now);
            a.CancelledByName = reason == CancelReason.KhachTuHuy ? a.Customer!.FullName : receptionist;
        }
    }

    /// <summary>Lịch sinh ngẫu nhiên vướng lịch của kịch bản kiểm thử hoặc khoảng phải để trống (06 §5.5 bước 2).</summary>
    private static bool Dropped(ResolvedAppointment r, IReadOnlyList<ResolvedAppointment> fixtures, IReadOnlyList<SeedReserve> reserve, SpaSeedClock clock)
    {
        foreach (var hold in reserve)
        {
            foreach (var line in r.Lines.Where(l => hold.Staff.Contains(l.Staff.Code)))
            {
                if (hold.Day == "T" && r.Date == clock.TestDay)
                    return true;
                if (hold.D is { } d && r.Date == clock.Today.AddDays(d))
                {
                    if (hold.From != "now" || line.StartUtc.AddMinutes(line.Service.DurationMinutes + line.Service.CleanupMinutes) > clock.Now)
                        return true;
                }
            }
        }

        foreach (var f in fixtures.Where(f => f.Date == r.Date))
        {
            foreach (var line in r.Lines)
            {
                foreach (var other in f.Lines.Where(o => o.Staff.Id == line.Staff.Id))
                {
                    if (BookingRules.Overlaps(line.Start, line.Start + line.Service.DurationMinutes + line.Service.CleanupMinutes,
                            other.Start, other.Start + other.Service.DurationMinutes + other.Service.CleanupMinutes))
                        return true;
                }
            }

            if (f.Seed.C == r.Seed.C && BookingRules.Overlaps(r.SpanStart, r.SpanEnd, f.SpanStart, f.SpanEnd))
                return true;
        }

        return false;
    }

    private static int MonthsBetween(int from, int to) => (to / 100 - from / 100) * 12 + (to % 100 - from % 100);

    private static DateTime Min(DateTime a, DateTime b) => a < b ? a : b;

    private sealed record ResolvedLine(Service Service, StaffMember Staff, int Start, DateTime StartUtc);

    private sealed record ResolvedAppointment(int Index, SeedAppointment Seed, DateOnly Date, List<ResolvedLine> Lines, bool Fixture)
    {
        public int SpanStart => Lines.Min(l => l.Start);
        public int SpanEnd => Lines.Max(l => l.Start + l.Service.DurationMinutes);
    }
}

/// <summary>Đồng hồ của lần nạp: suy ngày dạng tuần, lệch ngày, giờ "~-30", lúc tạo, trạng thái (06 §5.3, §5.4).</summary>
internal sealed class SpaSeedClock
{
    public SpaSeedClock(DateTime utcNow)
    {
        Now = DateTime.SpecifyKind(new DateTime(utcNow.Ticks - utcNow.Ticks % TimeSpan.TicksPerMinute), DateTimeKind.Utc);
        Today = VietnamDates.DateOf(Now);
        NowMinute = MinuteOf(Now);
        WeekStart = Today.AddDays(1 - BookingRules.IsoDayOfWeek(Today));
        var t = Today.AddDays(2);
        while (BookingRules.IsoDayOfWeek(t) != 2)
            t = t.AddDays(1);
        TestDay = t;
    }

    public DateTime Now { get; }
    public DateOnly Today { get; }
    public int NowMinute { get; }
    public DateOnly WeekStart { get; }

    /// <summary>Ngày T: Thứ Ba gần nhất cách hôm nay từ 2 ngày trở lên (05 §1).</summary>
    public DateOnly TestDay { get; }

    public DateOnly DayOf(ISeedDay day) =>
        day.D is { } d ? Today.AddDays(d) : WeekStart.AddDays(7 * day.W![0] + day.W[1] - 1);

    public DateTime ToUtc(DateOnly date, int minute) => VietnamDates.StartOfDayUtc(date).AddMinutes(minute);

    public static int MinuteOf(DateTime utc) =>
        (int)Math.Round((DateTime.SpecifyKind(utc, DateTimeKind.Utc) - VietnamDates.StartOfDayUtc(VietnamDates.DateOf(utc))).TotalMinutes);

    public static int ParseMinute(string hhmm) => int.Parse(hhmm[..2]) * 60 + int.Parse(hhmm[3..5]);

    /// <summary>"HH:mm" hoặc "~-30" (now − 30 phút, làm tròn xuống 15 phút, kẹp trong giờ mở cửa).</summary>
    public int StartMinute(string token, int duration)
    {
        if (!token.StartsWith('~'))
            return ParseMinute(token);
        var offset = int.Parse(token[1..]);
        var minute = BookingRules.Floor15(NowMinute + offset);
        return Math.Clamp(minute, BookingRules.DefaultOpenMinute, BookingRules.DefaultCloseMinute - duration);
    }

    public DateTime CreatedAt(int? cr, double? ld, DateTime start)
    {
        if (cr is { } minutes)
            return Now.AddMinutes(minutes);
        var created = start.AddMinutes(-Math.Round((ld ?? 24) * 60));
        return created > Now ? Now.AddMinutes(-5) : created;
    }

    public DateTime CustomerCreatedAt(int cr)
    {
        var at = ToUtc(Today.AddDays(cr), 10 * 60);
        return at > Now ? Now.AddMinutes(-1) : at;
    }

    /// <summary>Trạng thái theo kết cục dự định và lúc nạp (06 §5.4).</summary>
    public AppointmentStatus Status(string outcome, AppointmentSource source, DateOnly date, DateTime start, DateTime end)
    {
        if (outcome == "cancel")
            return AppointmentStatus.DaHuy;
        if (date < Today)
            return outcome == "noshow" ? AppointmentStatus.KhongDen : AppointmentStatus.HoanThanh;
        if (date == Today && end <= Now)
            return outcome switch
            {
                "done" => AppointmentStatus.HoanThanh,
                "noshow" => AppointmentStatus.KhongDen,
                _ => AppointmentStatus.DaXacNhan
            };
        if (date == Today && start <= Now)
            return outcome == "done" ? AppointmentStatus.DangPhucVu : AppointmentStatus.DaXacNhan;
        return outcome == "pending" && source == AppointmentSource.Online ? AppointmentStatus.ChoXacNhan : AppointmentStatus.DaXacNhan;
    }

    public static ShiftType Shift(char code) => code switch
    {
        'S' => ShiftType.Sang,
        'C' => ShiftType.Chieu,
        'F' => ShiftType.CaNgay,
        _ => ShiftType.Nghi
    };
}
