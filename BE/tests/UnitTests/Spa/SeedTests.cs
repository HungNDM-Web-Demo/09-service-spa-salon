using Application.Common.Time;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.Commissions;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;
using Xunit.Abstractions;

namespace UnitTests.Spa;

/// <summary>Dữ liệu mẫu bảo đảm ràng buộc của kịch bản kiểm thử (06 §5.6, 05 §1).</summary>
public sealed class SeedTests(ITestOutputHelper output)
{
    [Fact]
    public async Task Seed_bao_dam_ban_dau_cua_kich_ban_kiem_thu()
    {
        await using var host = await SpaTestHost.StartAsync();
        var today = SpaTestHost.Today;

        var customers = await host.QueryAsync<Customer, Dictionary<string, Customer>>(q => q.ToDictionaryAsync(c => c.Code));
        var staff = await host.QueryAsync<StaffMember, Dictionary<string, StaffMember>>(q => q.ToDictionaryAsync(s => s.Code));
        var packages = await host.QueryAsync<CustomerPackage, List<CustomerPackage>>(q => q.Include(p => p.Usages).ToListAsync());
        var appointments = await host.QueryAsync<Appointment, List<Appointment>>(q => q.Include(a => a.Lines).ToListAsync());

        // KH00001: GOI01 còn 6/10, buổi gần nhất 10 ngày trước, hạn còn trên 60 ngày.
        var lanAnh = packages.Single(p => p.CustomerId == customers["KH00001"].Id);
        Assert.Equal(6, lanAnh.Remaining);
        Assert.Equal(CustomerPackageStatus.DangDung, lanAnh.Status);
        Assert.True(lanAnh.ExpiryDate > today.AddDays(60));
        Assert.Equal(today.AddDays(-10), VietnamDates.DateOf(lanAnh.Usages.Where(u => !u.Refunded).Max(u => u.UsedAt)));
        Assert.Equal(280000m, lanAnh.SessionValue);

        // KH00002: 3 lần không đến trong 90 ngày; hôm nay một lịch DV001 với NV02 lúc 09:30, đã xác nhận.
        var chau = customers["KH00002"].Id;
        Assert.Equal(3, appointments.Count(a => a.CustomerId == chau && a.Status == AppointmentStatus.KhongDen && a.Date >= today.AddDays(-90)));
        var chauToday = appointments.Single(a => a.CustomerId == chau && a.Date == today);
        Assert.Equal(AppointmentStatus.DaXacNhan, chauToday.Status);
        Assert.Equal(SpaTestHost.At(today, "09:30"), chauToday.StartAt);
        Assert.Equal(staff["NV02"].Id, chauToday.Lines.Single().StaffMemberId);

        // KH00003: còn 4/10, buổi gần nhất 3 ngày trước.
        var ngoc = packages.Single(p => p.CustomerId == customers["KH00003"].Id);
        Assert.Equal(4, ngoc.Remaining);
        Assert.Equal(today.AddDays(-3), VietnamDates.DateOf(ngoc.Usages.Max(u => u.UsedAt)));

        // KH00004: hết hạn hôm qua, còn 2 buổi.
        var thao = packages.Single(p => p.CustomerId == customers["KH00004"].Id);
        Assert.Equal(CustomerPackageStatus.HetHan, thao.Status);
        Assert.Equal(2, thao.Remaining);
        Assert.Equal(today.AddDays(-1), thao.ExpiryDate);

        // KH00005, KH00006: chưa có gói, không có lịch từ hôm nay.
        foreach (var code in new[] { "KH00005", "KH00006", "KH00001" })
        {
            Assert.DoesNotContain(appointments, a => a.CustomerId == customers[code].Id && a.Date >= today);
            if (code != "KH00001")
                Assert.DoesNotContain(packages, p => p.CustomerId == customers[code].Id);
        }

        // KH00007 Phan Thị Hạnh: ngày mai DV005 với NV01 lúc 10:00, chờ xác nhận, tạo 45 phút trước.
        var hanh = appointments.Single(a => a.CustomerId == customers["KH00007"].Id && a.Date == today.AddDays(1));
        Assert.Equal(AppointmentStatus.ChoXacNhan, hanh.Status);
        Assert.Equal(SpaTestHost.At(today.AddDays(1), "10:00"), hanh.StartAt);
        Assert.Equal(SpaTestHost.Start.UtcDateTime.AddMinutes(-45), hanh.CreatedAt);

        // Ngày mai NV01 có ít nhất 2 lịch đã xác nhận.
        Assert.True(appointments.Count(a => a.Date == today.AddDays(1) && a.Status == AppointmentStatus.DaXacNhan
                                            && a.Lines.Any(l => l.StaffMemberId == staff["NV01"].Id)) >= 2);

        // Ngày T: NV01, NV03, NV05 không có lịch nào.
        var free = new[] { staff["NV01"].Id, staff["NV03"].Id, staff["NV05"].Id };
        Assert.DoesNotContain(appointments, a => a.Date == SpaTestHost.TestDay && a.Lines.Any(l => free.Contains(l.StaffMemberId)));

        // Hôm nay: NV01, NV05 trống từ lúc nạp tới hết ngày.
        var now = SpaTestHost.Start.UtcDateTime;
        Assert.DoesNotContain(appointments, a => a.Date == today && a.Lines.Any(l =>
            (l.StaffMemberId == staff["NV01"].Id || l.StaffMemberId == staff["NV05"].Id) && l.EndAt.AddMinutes(l.CleanupMinutes) > now));

        // Chưa có các số điện thoại của kịch bản.
        foreach (var phone in new[] { "0976543210", "0987654321", "0977111222", "0911000001", "0911000002" })
            Assert.DoesNotContain(customers.Values, c => c.Phone == phone);

        // Bảng hoa hồng: tháng trước tạm tính, tháng trước nữa đã chốt, cả hai có hóa đơn.
        var periods = await host.QueryAsync<CommissionPeriod, Dictionary<int, CommissionPeriod>>(q => q.ToDictionaryAsync(p => p.Month));
        Assert.Equal(CommissionPeriodStatus.TamTinh, periods[202609].Status);
        Assert.Equal(CommissionPeriodStatus.DaChot, periods[202608].Status);
        var invoices = await host.QueryAsync<Invoice, List<Invoice>>(q => q.ToListAsync());
        Assert.Contains(invoices, i => VietnamDates.DateOf(i.PaidAt).Month == 9);
        Assert.Contains(invoices, i => VietnamDates.DateOf(i.PaidAt).Month == 8);

        // Mã chứng từ không trùng, đúng định dạng.
        Assert.Equal(appointments.Count, appointments.Select(a => a.Code).Distinct().Count());
        Assert.All(appointments, a => Assert.Matches(@"^LH\d{9}$", a.Code));
        Assert.Equal(invoices.Count, invoices.Select(i => i.Code).Distinct().Count());

        // Không có hai dòng chiếm chỗ trùng nhau của cùng KTV.
        var occupying = appointments.Where(a => a.IsOccupying).SelectMany(a => a.Lines).ToList();
        foreach (var group in occupying.GroupBy(l => l.StaffMemberId))
        {
            var ordered = group.OrderBy(l => l.StartAt).ToList();
            for (var i = 1; i < ordered.Count; i++)
                Assert.True(ordered[i].StartAt >= ordered[i - 1].EndAt.AddMinutes(ordered[i - 1].CleanupMinutes),
                    $"Trùng lịch {group.Key} lúc {ordered[i].StartAt:O}");
        }

        var commissions = await host.QueryAsync<Commission, decimal>(q => q.SumAsync(c => c.Amount));
        output.WriteLine($"Lịch hẹn {appointments.Count}: " + string.Join(", ", appointments.GroupBy(a => a.Status).OrderBy(g => g.Key).Select(g => $"{g.Key} {g.Count()}")));
        output.WriteLine($"Dòng {appointments.Sum(a => a.Lines.Count)}, hóa đơn {invoices.Count}, thực thu {invoices.Sum(i => i.Total):N0}, gói {packages.Count}, lần trừ {packages.Sum(p => p.Usages.Count)}, hoa hồng {commissions:N0}");
        output.WriteLine($"Hôm nay: {string.Join(", ", appointments.Where(a => a.Date == today).GroupBy(a => a.Status).Select(g => $"{g.Key} {g.Count()}"))}");
    }
}
