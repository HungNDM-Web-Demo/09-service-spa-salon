using Application.Common.Exceptions;
using Application.DTOs.Booking;
using Application.DTOs.Crm;
using Application.Interfaces.Services.Booking;
using Application.Interfaces.Services.Crm;
using Application.Interfaces.Services.Hr;
using Domain.Common;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.Services;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.StaffMembers;
using Domain.Enums.Booking;
using Domain.Enums.Hr;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using UnitTests.TestSupport;

namespace UnitTests.Spa;

/// <summary>
/// Chạy lần lượt kịch bản kiểm thử nghiệm thu (05-KICH-BAN-KIEM-THU §2, TC-06 đến TC-42) trên service thật, chế độ api.
/// Lúc nạp: 10:00 Thứ Năm 22/10/2026; ngày T = Thứ Ba 27/10/2026.
/// </summary>
public sealed class AcceptanceScenarioTests
{
    private static readonly DateOnly Today = SpaTestHost.Today;
    private static readonly DateOnly T = SpaTestHost.TestDay;

    [Fact]
    public async Task Trang_dat_lich_moi_nhom_dich_vu_xuat_hien_mot_lan()
    {
        await using var host = await SpaTestHost.StartAsync();
        var catalog = await host.CallAsync<IPublicBookingService, PublicCatalogDto>(s => s.GetCatalogAsync());

        Assert.Equal(catalog.Groups.Count, catalog.Groups.Select(g => g.Id).Distinct().Count());
        Assert.Contains(catalog.Groups, g => g.Services.Count > 1);
    }

    [Fact]
    public async Task Kich_ban_kiem_thu_TC06_den_TC42()
    {
        await using var host = await SpaTestHost.StartAsync();
        var staff = await host.QueryAsync<StaffMember, Dictionary<string, Guid>>(q => q.ToDictionaryAsync(s => s.Code, s => s.Id));
        var services = await host.QueryAsync<Service, Dictionary<string, Guid>>(q => q.ToDictionaryAsync(s => s.Code, s => s.Id));
        async Task<Guid> CustomerId(string phone) => await host.QueryAsync<Customer, Guid>(q => q.Where(c => c.Phone == phone).Select(c => c.Id).SingleAsync());
        DraftLineRequest Line(string service, string nv, DateOnly date, string hhmm, Guid? lineId = null) =>
            new() { ServiceId = services[service], StaffMemberId = staff[nv], StartAt = SpaTestHost.At(date, hhmm), LineId = lineId };

        await host.SignInAsync("quanly");
        var before = await Snapshot(host, staff);

        await host.SignInAsync("nhanvien");
        var lanAnh = await CustomerId("0903123456");

        // TC-06: tạo lịch hẹn ngày T, NV01 14:00, DV001.
        var lookup = await host.CallAsync<ICustomerService, CustomerLookupDto>(s => s.LookupAsync("0903 123 456"));
        Assert.Equal("Nguyễn Thị Lan Anh", lookup.Customer!.FullName);
        Assert.Contains(lookup.Packages, p => p.ServiceId == services["DV001"] && p.Remaining == 6);
        var tc06 = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.CreateAsync(new CreateAppointmentRequest
        {
            CustomerId = lanAnh,
            Source = AppointmentSource.DienThoai,
            Lines = [Line("DV001", "NV01", T, "14:00")]
        }));
        Assert.Matches(@"^LH261022\d{3}$", tc06.Code);
        Assert.Equal(AppointmentStatus.DaXacNhan, tc06.Status);
        Assert.Equal(SpaTestHost.At(T, "15:00"), tc06.EndAt);
        Assert.Contains(tc06.Messages, m => m.Kind == MessageKind.XacNhan);

        // TC-07: trùng KTV do thời gian dọn, rồi 15:15 hợp lệ, tạo khách mới.
        var check07 = await host.CallAsync<IAppointmentService, CheckResultDto>(s => s.CheckAsync(new CheckAppointmentRequest { Lines = [Line("DV005", "NV01", T, "15:00")] }));
        Assert.Contains("Nguyễn Thị Mai bận tới 15:10 (gồm thời gian dọn)", check07.Lines[0].Issues.Select(i => i.Message));
        var check07b = await host.CallAsync<IAppointmentService, CheckResultDto>(s => s.CheckAsync(new CheckAppointmentRequest { Lines = [Line("DV005", "NV01", T, "15:15")] }));
        Assert.True(check07b.Ok);
        Assert.Equal(SpaTestHost.At(T, "16:45"), check07b.Lines[0].EndAt);
        var tc07 = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.CreateAsync(new CreateAppointmentRequest
        {
            NewCustomer = new NewCustomerRequest { Phone = "0976543210", FullName = "Trương Mỹ Linh" },
            Lines = [Line("DV005", "NV01", T, "15:15")]
        }));
        Assert.Equal("Trương Mỹ Linh", tc07.CustomerName);

        // TC-08: KTV không làm được dịch vụ.
        var options = await host.CallAsync<IServiceCatalogService, IReadOnlyList<ServiceOption>>(s => s.GetOptionsAsync());
        Assert.DoesNotContain(staff["NV03"], options.Single(o => o.Code == "DV001").TechnicianIds);
        var check08 = await host.CallAsync<IAppointmentService, CheckResultDto>(s => s.CheckAsync(new CheckAppointmentRequest { Lines = [Line("DV001", "NV03", T, "16:00")] }));
        Assert.Contains("Lê Hoàng Yến không làm được Chăm sóc da cơ bản", check08.Lines[0].Issues.Select(i => i.Message));

        // TC-09: ngoài ca, quá giờ đóng cửa.
        var check09a = await host.CallAsync<IAppointmentService, CheckResultDto>(s => s.CheckAsync(new CheckAppointmentRequest { Lines = [Line("DV008", "NV03", T, "14:30")] }));
        Assert.Contains("Ngoài ca làm (ca chiều 15:00–21:00)", check09a.Lines[0].Issues.Select(i => i.Message));
        var check09b = await host.CallAsync<IAppointmentService, CheckResultDto>(s => s.CheckAsync(new CheckAppointmentRequest { Lines = [Line("DV008", "NV03", T, "20:30")] }));
        Assert.Equal(["Kết thúc 21:15, quá giờ đóng cửa (21:00)"], check09b.Lines[0].Issues.Select(i => i.Message));
        var check09c = await host.CallAsync<IAppointmentService, CheckResultDto>(s => s.CheckAsync(new CheckAppointmentRequest { Lines = [Line("DV008", "NV03", T, "20:15")] }));
        Assert.True(check09c.Ok);
        Assert.Equal(SpaTestHost.At(T, "21:00"), check09c.Lines[0].EndAt);

        // TC-10: trùng lịch của khách; thêm dòng song song vào lịch TC-06.
        var check10 = await host.CallAsync<IAppointmentService, CheckResultDto>(s => s.CheckAsync(new CheckAppointmentRequest
        {
            CustomerId = lanAnh,
            Lines = [Line("DV008", "NV05", T, "14:30")]
        }));
        Assert.Contains($"Khách đã có lịch {tc06.Code} 14:00–15:00", check10.Issues.Select(i => i.Message));
        tc06 = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.UpdateAsync(tc06.Id, new UpdateAppointmentRequest
        {
            Lines = [Line("DV001", "NV01", T, "14:00", tc06.Lines[0].Id), Line("DV008", "NV05", T, "14:00")]
        }));
        Assert.Equal(2, tc06.Lines.Count);
        Assert.Equal(SpaTestHost.At(T, "14:45"), tc06.Lines.Single(l => l.ServiceName == "Gội đầu dưỡng sinh").EndAt);

        // TC-11: cảnh báo khách hay bỏ hẹn.
        var chau = await host.CallAsync<ICustomerService, CustomerLookupDto>(s => s.LookupAsync("0912555888"));
        Assert.True(chau.Customer!.IsFlagged);
        Assert.Equal(3, chau.Customer.NoShowCount90);

        // TC-12: khách đặt online DV005 với NV03 ngày T 17:00.
        var tc12 = await host.CallAsync<IPublicBookingService, PublicAppointmentDto>(s => s.BookAsync(new PublicBookingRequest
        {
            ServiceIds = [services["DV005"]],
            StaffMemberId = staff["NV03"],
            StartAt = SpaTestHost.At(T, "17:00"),
            FullName = "Đỗ Thu Trang",
            Phone = "0987654321"
        }));
        Assert.Equal(AppointmentStatus.ChoXacNhan, tc12.Status);
        Assert.Equal(SpaTestHost.At(T, "18:30"), tc12.EndAt);
        Assert.Equal(550000m, tc12.Total);

        // TC-13: mốc trống tính cả thời gian dọn.
        var slots = await host.CallAsync<IPublicBookingService, PublicSlotsDto>(s => s.GetSlotsAsync(new PublicSlotsQuery
        {
            ServiceIds = services["DV001"].ToString(),
            StaffMemberId = staff["NV01"],
            Date = "2026-10-27"
        }));
        Assert.Equal(
            ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"],
            slots.Slots);

        // TC-14: giới hạn 2 lịch online theo số điện thoại.
        var tc14 = await host.CallAsync<IPublicBookingService, PublicAppointmentDto>(s => s.BookAsync(new PublicBookingRequest
        {
            ServiceIds = [services["DV008"]],
            StaffMemberId = staff["NV05"],
            StartAt = SpaTestHost.At(T, "10:00"),
            FullName = "Đỗ Thu Trang",
            Phone = "0987654321"
        }));
        var tooMany = await Assert.ThrowsAsync<DomainException>(() => host.CallAsync<IPublicBookingService, PublicAppointmentDto>(s => s.BookAsync(new PublicBookingRequest
        {
            ServiceIds = [services["DV012"]],
            StaffMemberId = null,
            StartAt = SpaTestHost.At(T, "11:00"),
            FullName = "Đỗ Thu Trang",
            Phone = "0987654321"
        })));
        Assert.Equal("Số điện thoại này đã có 2 lịch đang chờ, vui lòng gọi tiệm", tooMany.Message);

        // TC-15: "Bất kỳ ai" xếp KTV ít phút nhất trong ngày.
        var tc15 = await host.CallAsync<IPublicBookingService, PublicAppointmentDto>(s => s.BookAsync(new PublicBookingRequest
        {
            ServiceIds = [services["DV005"]],
            StaffMemberId = null,
            StartAt = SpaTestHost.At(T, "19:00"),
            FullName = "Lý Mỹ Duyên",
            Phone = "0977111222"
        }));
        Assert.Equal("Lê Hoàng Yến", tc15.Lines.Single().StaffName);
        Assert.Equal(SpaTestHost.At(T, "20:30"), tc15.EndAt);

        // TC-16: hai người cùng đặt một mốc, chỉ một lịch được lưu.
        Task<PublicAppointmentDto> Race(string phone) => host.CallAsync<IPublicBookingService, PublicAppointmentDto>(s => s.BookAsync(new PublicBookingRequest
        {
            ServiceIds = [services["DV001"]],
            StaffMemberId = staff["NV01"],
            StartAt = SpaTestHost.At(T, "09:00"),
            FullName = $"Khách {phone[^3..]}",
            Phone = phone
        }));
        var race = await Task.WhenAll(Capture(Race("0911000001")), Capture(Race("0911000002")));
        Assert.Single(race, r => r is null);
        var loser = Assert.IsType<ConflictException>(race.Single(r => r is not null));
        Assert.Equal("Giờ này vừa có người đặt, vui lòng chọn giờ khác", loser.Message);

        // TC-17: xác nhận lịch online.
        var tc12Id = await host.QueryAsync<Domain.Entities.Booking.Appointments.Appointment, Guid>(q => q.Where(a => a.Code == tc12.Code).Select(a => a.Id).SingleAsync());
        var confirmed = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.ConfirmAsync(tc12Id));
        Assert.Equal(AppointmentStatus.DaXacNhan, confirmed.Status);
        Assert.Contains(confirmed.Messages, m => m.Kind == MessageKind.XacNhan);

        // TC-18: kéo thả đổi giờ hợp lệ.
        var moved = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.MoveLineAsync(tc07.Id, tc07.Lines[0].Id,
            new MoveLineRequest { StaffMemberId = staff["NV01"], StartAt = SpaTestHost.At(T, "18:00") }));
        Assert.Equal(SpaTestHost.At(T, "19:30"), moved.EndAt);

        // TC-19: kéo sang KTV không làm được.
        var lanAnhLine = tc06.Lines.Single(l => l.ServiceName == "Chăm sóc da cơ bản");
        var bounced = await Assert.ThrowsAsync<DomainException>(() => host.CallAsync<IAppointmentService, AppointmentDetailDto>(s =>
            s.MoveLineAsync(tc06.Id, lanAnhLine.Id, new MoveLineRequest { StaffMemberId = staff["NV03"], StartAt = SpaTestHost.At(T, "14:00") })));
        Assert.Equal("Lê Hoàng Yến không làm được Chăm sóc da cơ bản", bounced.Message);

        // TC-20: hủy lịch, chỗ trống trở lại.
        var cancelled = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.CancelAsync(tc12Id, new CancelAppointmentRequest { Reason = CancelReason.KhachBaoHuy }));
        Assert.Equal(AppointmentStatus.DaHuy, cancelled.Status);
        var slots20 = await host.CallAsync<IPublicBookingService, PublicSlotsDto>(s => s.GetSlotsAsync(new PublicSlotsQuery
        {
            ServiceIds = services["DV005"].ToString(),
            StaffMemberId = staff["NV03"],
            Date = "2026-10-27"
        }));
        Assert.Contains("17:00", slots20.Slots);

        // TC-21: lịch online chờ quá 30 phút tô cam.
        var board = await host.CallAsync<IAppointmentService, BoardDto>(s => s.GetBoardAsync("2026-10-23"));
        Assert.True(board.Appointments.Single(a => a.CustomerName == "Phan Thị Hạnh").PendingOverdue);
        var dashboard = await host.CallAsync<IDashboardService, DashboardTodayDto>(s => s.GetTodayAsync());
        Assert.True(dashboard.PendingOnline.Single(a => a.CustomerName == "Phan Thị Hạnh").PendingOverdue);

        // TC-22: khách tự hủy; dưới 2 giờ không hủy được.
        var seen = await host.CallAsync<IPublicBookingService, PublicAppointmentDto>(s => s.LookupAsync(new PublicLookupRequest { Code = tc14.Code, Phone = "0987654321" }, "tc22"));
        Assert.Equal("0987 *** 321", seen.PhoneMasked);
        Assert.True(seen.CanCancel);
        var selfCancelled = await host.CallAsync<IPublicBookingService, PublicAppointmentDto>(s => s.CancelAsync(new PublicCancelRequest { Code = tc14.Code, Phone = "0987654321", Reason = "Bận việc" }, "tc22"));
        Assert.Equal(AppointmentStatus.DaHuy, selfCancelled.Status);
        var chauToday = (await host.CallAsync<IAppointmentService, BoardDto>(s => s.GetBoardAsync("2026-10-22")))
            .Appointments.Single(a => a.CustomerName == "Hoàng Minh Châu");
        var chauPublic = await host.CallAsync<IPublicBookingService, PublicAppointmentDto>(s => s.LookupAsync(new PublicLookupRequest { Code = chauToday.Code, Phone = "0912555888" }, "tc22"));
        Assert.False(chauPublic.CanCancel);
        Assert.Equal("0905 286 168", chauPublic.Hotline);

        // TC-23: check-in, thêm dịch vụ phát sinh nối tiếp.
        var tc23 = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.CreateAsync(new CreateAppointmentRequest
        {
            CustomerId = lanAnh,
            Lines = [Line("DV001", "NV01", Today, "10:00")]
        }));
        tc23 = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.CheckInAsync(tc23.Id));
        Assert.Equal(AppointmentStatus.DangPhucVu, tc23.Status);
        Assert.NotNull(tc23.CheckedInAt);
        tc23 = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.UpdateAsync(tc23.Id, new UpdateAppointmentRequest
        {
            Lines = [Line("DV001", "NV01", Today, "10:00", tc23.Lines[0].Id), Line("DV008", "NV05", Today, "11:00")]
        }));
        var added = tc23.Lines.Single(l => l.ServiceName == "Gội đầu dưỡng sinh");
        Assert.Equal(SpaTestHost.At(Today, "11:00"), added.StartAt);
        Assert.Equal(45, added.DurationMinutes);

        // TC-24: lịch không phải hôm nay không có check-in, không đến.
        var tc06Detail = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.GetAsync(tc06.Id));
        Assert.False(tc06Detail.Actions.CanCheckIn);
        Assert.False(tc06Detail.Actions.CanNoShow);

        // TC-25: ghi nhận không đến.
        var noShow = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.NoShowAsync(chauToday.Id));
        Assert.Equal(AppointmentStatus.KhongDen, noShow.Status);
        Assert.Equal(4, noShow.Customer.NoShowCount90);
        var hanh = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.GetAsync(board.Appointments.Single(a => a.CustomerName == "Phan Thị Hạnh").Id));
        Assert.False(hanh.Actions.CanNoShow);

        // TC-26: thanh toán có trừ buổi, chuyển khoản.
        var preview = await host.CallAsync<IAppointmentService, CheckoutPreviewDto>(s => s.GetCheckoutPreviewAsync(tc23.Id));
        Assert.Equal(10, preview.DiscountLimitPercent);
        var tc26 = await Checkout(host, tc23.Id, 150000m, PaymentMethod.ChuyenKhoan);
        var tc26Line = tc26.Lines.Single(l => l.Description == "Chăm sóc da cơ bản");
        Assert.True(tc26Line.UsesPackage);
        Assert.Equal(0m, tc26Line.Amount);
        Assert.Equal(5, tc26Line.PackageRemaining);
        Assert.Equal(150000m, tc26.Total);
        Assert.Matches(@"^HD261022\d{3}$", tc26.Code);
        Assert.Equal(AppointmentStatus.HoanThanh, (await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.GetAsync(tc23.Id))).Status);

        // TC-27: giảm vượt hạn mức, tiền mặt không đủ.
        var giaHan = await CustomerId("0935135790");
        var tc27 = await CheckedIn(host, giaHan, [Line("DV005", "NV01", Today, "11:15"), Line("DV008", "NV05", Today, "12:45")]);
        var over = await Assert.ThrowsAsync<ValidationException>(() => Checkout(host, tc27.Id, 595000m, PaymentMethod.TienMat, cash: 700000m,
            discount: new DiscountRequest { Type = DiscountType.PhanTram, Value = 15, Reason = "Khách quen" }));
        Assert.Contains(over.Errors, e => e.PropertyName == "discount.value" && e.ErrorMessage == "Lễ tân giảm tối đa 10% (70.000 ₫)");
        var shortCash = await Assert.ThrowsAsync<ValidationException>(() => Checkout(host, tc27.Id, 630000m, PaymentMethod.TienMat, cash: 500000m,
            discount: new DiscountRequest { Type = DiscountType.PhanTram, Value = 10, Reason = "Khách quen" }));
        Assert.Contains(shortCash.Errors, e => e.PropertyName == "cashReceived" && e.ErrorMessage == "Tiền khách đưa chưa đủ, còn thiếu 130.000 ₫");

        // TC-28: tiền mặt có giảm giá; hoa hồng không trừ giảm giá.
        var tc28 = await Checkout(host, tc27.Id, 630000m, PaymentMethod.TienMat, cash: 700000m,
            discount: new DiscountRequest { Type = DiscountType.PhanTram, Value = 10, Reason = "Khách quen" });
        Assert.Equal(70000m, tc28.ChangeAmount);
        Assert.Equal(55000m, tc28.Lines.Single(l => l.Description == "Massage body đá nóng").CommissionAmount);
        Assert.Equal(30000m, tc28.Lines.Single(l => l.Description == "Gội đầu dưỡng sinh").CommissionAmount);

        // TC-29: trừ buổi chưa đủ khoảng cách, hóa đơn 0 ₫.
        var ngoc = await CustomerId("0938777222");
        var tc29 = await CheckedIn(host, ngoc, [Line("DV001", "NV01", Today, "13:00")]);
        var gap = await Assert.ThrowsAsync<ValidationException>(() => Checkout(host, tc29.Id, 0m, PaymentMethod.TienMat));
        Assert.Contains(gap.Errors, e => e.PropertyName == "intervalOverrideReason" && e.ErrorMessage.StartsWith("Buổi gần nhất cách 3 ngày, gói yêu cầu 7 ngày"));
        var tc29Invoice = await Checkout(host, tc29.Id, 0m, PaymentMethod.TienMat, overrideReason: "Khách đi công tác, xin làm sớm");
        Assert.Equal(PaymentMethod.KhongThu, tc29Invoice.Method);
        Assert.Equal(3, tc29Invoice.Lines.Single().PackageRemaining);
        Assert.Equal(33000m, tc29Invoice.Lines.Single().CommissionAmount);

        // TC-30: bán gói kèm, trừ buổi đầu ngay, giảm giá chỉ tính trên dịch vụ lẻ.
        var tam = await CustomerId("0916888999");
        var tc30 = await CheckedIn(host, tam, [Line("DV005", "NV01", Today, "14:15"), Line("DV008", "NV05", Today, "15:45")]);
        var templates = await host.CallAsync<IPackageTemplateService, IReadOnlyList<PackageTemplateDto>>(s => s.GetOptionsAsync());
        var goi03 = templates.Single(t => t.Code == "GOI03");
        var tc30Invoice = await Checkout(host, tc30.Id, 2435000m, PaymentMethod.ChuyenKhoan,
            discount: new DiscountRequest { Type = DiscountType.PhanTram, Value = 10, Reason = "Khuyến mãi trong tháng" },
            sell: [new SellPackageChoice { PackageTemplateId = goi03.Id, ConsultantStaffId = staff["NV01"] }]);
        Assert.Equal(15000m, tc30Invoice.DiscountAmount);
        var stone = tc30Invoice.Lines.Single(l => l.Description == "Massage body đá nóng");
        Assert.True(stone.UsesPackage);
        Assert.Equal(4, stone.PackageRemaining);
        Assert.Equal(new DateOnly(2027, 2, 22), stone.PackageExpiryDate);
        Assert.Equal(46000m, stone.CommissionAmount);
        Assert.Equal(115000m, tc30Invoice.Lines.Single(l => l.Kind == InvoiceLineKind.BanGoi).CommissionAmount);
        Assert.Equal(30000m, tc30Invoice.Lines.Single(l => l.Description == "Gội đầu dưỡng sinh").CommissionAmount);

        // TC-31: bán gói riêng.
        var goi01 = templates.Single(t => t.Code == "GOI01");
        var tc31 = await host.CallAsync<IInvoiceService, CreateResult<InvoiceDto>>(s => s.SellPackageAsync(new PackageSaleRequest
        {
            ClientRequestId = Guid.NewGuid().ToString(),
            CustomerId = giaHan,
            PackageTemplateId = goi01.Id,
            ConsultantStaffId = staff["NV05"],
            Method = PaymentMethod.TienMat,
            CashReceived = 3000000m,
            ExpectedTotal = 2800000m
        }));
        Assert.Equal(200000m, tc31.Value.ChangeAmount);
        var sold = tc31.Value.Lines.Single();
        Assert.Matches(@"^GL261022\d{3}$", sold.PackageCode);
        Assert.Equal(10, sold.PackageRemaining);
        Assert.Equal(new DateOnly(2027, 4, 22), sold.PackageExpiryDate);
        Assert.Equal(140000m, sold.CommissionAmount);

        // TC-32: thiếu thông tin; gói ngừng bán không có trong danh sách.
        var invalid = await host.CallAsync<IValidator<PackageSaleRequest>, FluentValidation.Results.ValidationResult>(v =>
            v.ValidateAsync(new PackageSaleRequest { PackageTemplateId = goi01.Id }));
        Assert.Contains(invalid.Errors, e => e.PropertyName == nameof(PackageSaleRequest.CustomerId));
        Assert.Contains(invalid.Errors, e => e.PropertyName == nameof(PackageSaleRequest.ConsultantStaffId));
        Assert.DoesNotContain(templates, t => t.Code == "GOI08");

        // TC-33: gói hết hạn không trừ được.
        var thao = await CustomerId("0909246810");
        var tc33 = await CheckedIn(host, thao, [Line("DV001", "NV05", Today, "16:45")]);
        var tc33Preview = await host.CallAsync<IAppointmentService, CheckoutPreviewDto>(s => s.GetCheckoutPreviewAsync(tc33.Id));
        Assert.Contains(tc33Preview.Packages, p => p.Status == CustomerPackageStatus.HetHan && p.ExpiryDate == Today.AddDays(-1));
        var tc33Invoice = await Checkout(host, tc33.Id, 350000m, PaymentMethod.TienMat, cash: 350000m);
        Assert.False(tc33Invoice.Lines.Single().UsesPackage);
        Assert.Equal(0m, tc33Invoice.ChangeAmount);
        Assert.Equal(42000m, tc33Invoice.Lines.Single().CommissionAmount);

        // TC-34: chủ tiệm hủy hóa đơn trả buổi và hoa hồng.
        await host.SignInAsync("quanly");
        var tc34 = await host.CallAsync<IInvoiceService, InvoiceDto>(s => s.CancelAsync(tc26.Id, new CancelInvoiceRequest { Reason = "Thu nhầm phương thức" }));
        Assert.Equal(InvoiceStatus.DaHuy, tc34.Status);
        Assert.Equal(AppointmentStatus.DangPhucVu, (await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.GetAsync(tc23.Id))).Status);
        var lanAnhAfter = await host.CallAsync<ICustomerService, CustomerLookupDto>(s => s.LookupAsync("0903123456"));
        Assert.Equal(6, lanAnhAfter.Packages.Single(p => p.ServiceId == services["DV001"]).Remaining);

        // TC-35: hóa đơn của tháng đã chốt không hủy được.
        var august = await host.QueryAsync<Invoice, Guid>(q => q.Where(i => i.PaidAt < new DateTime(2026, 8, 31, 0, 0, 0, DateTimeKind.Utc)
                                                                        && i.PaidAt >= new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc)
                                                                        && i.Status == InvoiceStatus.DaThanhToan).Select(i => i.Id).FirstAsync());
        var augustDto = await host.CallAsync<IInvoiceService, InvoiceDto>(s => s.GetAsync(august));
        Assert.False(augustDto.CanCancel);
        Assert.Equal("Tháng 08/2026 đã chốt hoa hồng", augustDto.CancelBlockedReason);

        // TC-36: bảng hoa hồng tháng này.
        var after = await Snapshot(host, staff);
        Assert.Equal(249000m, after["NV01"] - before["NV01"]);
        Assert.Equal(242000m, after["NV05"] - before["NV05"]);
        var items = await host.CallAsync<ICommissionService, IReadOnlyList<Application.DTOs.Hr.CommissionItemDto>>(s =>
            s.GetItemsAsync(new Application.DTOs.Hr.CommissionItemsQuery { Month = "2026-10", StaffMemberId = staff["NV01"] }));
        var today = items.Where(i => i.EarnedAt >= SpaTestHost.At(Today, "00:00")).Select(i => i.Amount).Order().ToList();
        Assert.Equal([33000m, 46000m, 55000m, 115000m], today);

        // TC-37: chốt bảng hoa hồng.
        var notYet = await Assert.ThrowsAsync<ConflictException>(() => host.CallAsync<ICommissionService, Application.DTOs.Hr.CommissionSheetDto>(s => s.CloseAsync("2026-10")));
        Assert.Equal("Chỉ chốt từ 01/11/2026", notYet.Message);
        var closed = await host.CallAsync<ICommissionService, Application.DTOs.Hr.CommissionSheetDto>(s => s.CloseAsync("2026-09"));
        Assert.Equal(CommissionPeriodStatus.DaChot, closed.Status);
        Assert.Equal("Lâm Ngọc Diệp", closed.ClosedByName);
        var september = await host.QueryAsync<Invoice, Guid>(q => q.Where(i => i.PaidAt >= new DateTime(2026, 9, 5, 0, 0, 0, DateTimeKind.Utc)
                                                                           && i.PaidAt < new DateTime(2026, 9, 25, 0, 0, 0, DateTimeKind.Utc)
                                                                           && i.Status == InvoiceStatus.DaThanhToan).Select(i => i.Id).FirstAsync());
        Assert.False((await host.CallAsync<IInvoiceService, InvoiceDto>(s => s.GetAsync(september))).CanCancel);

        // TC-38: KTV xem lịch và hoa hồng của mình.
        await host.SignInAsync("kythuatvien");
        var mine = await host.CallAsync<IMyScheduleService, Application.DTOs.Hr.MyScheduleDto>(s => s.GetAsync("2026-10-27"));
        var duyen = mine.Items.Single(i => i.CustomerName == "Lý Mỹ Duyên");
        Assert.Equal(SpaTestHost.At(T, "19:00"), duyen.StartAt);
        Assert.Equal(SpaTestHost.At(T, "20:30"), duyen.EndAt);
        var myCommissions = await host.CallAsync<ICommissionService, Application.DTOs.Hr.MyCommissionsDto>(s => s.GetMineAsync(null));
        var nv03Lines = await host.QueryAsync<Domain.Entities.Hr.Commissions.Commission, int>(q => q.CountAsync(c => c.Month == 202610 && c.StaffMemberId == staff["NV03"]));
        Assert.Equal(nv03Lines, myCommissions.Items.Count);

        // TC-39: hồ sơ khách.
        await host.SignInAsync("nhanvien");
        var profile = await host.CallAsync<ICustomerService, CustomerDto>(s => s.GetAsync(lanAnh));
        Assert.Equal("Da nhạy cảm, dị ứng AHA", profile.Note);
        var history = await host.CallAsync<IAppointmentService, Application.Common.Models.PaginatedResult<AppointmentListItem>>(s =>
            s.GetPagedAsync(new AppointmentQuery { CustomerId = lanAnh, PageSize = 50, SortBy = "startAt" }));
        Assert.Contains(history.Items, a => a.Date == Today && a.Status == AppointmentStatus.DangPhucVu);
        Assert.Contains(history.Items, a => a.Date == T && a.Status == AppointmentStatus.DaXacNhan);

        // TC-40, TC-42: tổng quan và báo cáo cập nhật theo hóa đơn.
        await host.SignInAsync("quanly");
        var dashAfter = await host.CallAsync<IDashboardService, DashboardTodayDto>(s => s.GetTodayAsync());
        Assert.Equal(6215000m, dashAfter.RevenueToday - before.Revenue);
        Assert.Equal(4, dashAfter.Counts.Completed - before.Completed);
        Assert.Equal(1, dashAfter.Counts.NoShow - before.NoShow);
        var report = await host.CallAsync<IReportService, RevenueReportDto>(s => s.GetRevenueAsync(new ReportRangeQuery { From = "2026-10-22", To = "2026-10-22" }));
        Assert.Equal(5100000m, report.Totals.PackageRevenue - before.PackageRevenue);
        Assert.Equal(1115000m, report.Totals.ServiceRevenue - before.ServiceRevenue);
        Assert.Equal(1940000m, report.Totals.ServiceValue - before.ServiceValue);
    }

    private sealed class Numbers : Dictionary<string, decimal>
    {
        public decimal Revenue { get; init; }
        public int Completed { get; init; }
        public int NoShow { get; init; }
        public decimal PackageRevenue { get; init; }
        public decimal ServiceRevenue { get; init; }
        public decimal ServiceValue { get; init; }
    }

    /// <summary>Số liệu gốc chủ tiệm ghi trước TC-23 (05 §1).</summary>
    private static async Task<Numbers> Snapshot(SpaTestHost host, IReadOnlyDictionary<string, Guid> staff)
    {
        var sheet = await host.CallAsync<ICommissionService, Application.DTOs.Hr.CommissionSheetDto>(s => s.GetSheetAsync("2026-10"));
        var dash = await host.CallAsync<IDashboardService, DashboardTodayDto>(s => s.GetTodayAsync());
        var report = await host.CallAsync<IReportService, RevenueReportDto>(s => s.GetRevenueAsync(new ReportRangeQuery { From = "2026-10-22", To = "2026-10-22" }));
        var numbers = new Numbers
        {
            Revenue = dash.RevenueToday,
            Completed = dash.Counts.Completed,
            NoShow = dash.Counts.NoShow,
            PackageRevenue = report.Totals.PackageRevenue,
            ServiceRevenue = report.Totals.ServiceRevenue,
            ServiceValue = report.Totals.ServiceValue
        };
        foreach (var code in new[] { "NV01", "NV05" })
            numbers[code] = sheet.Rows.FirstOrDefault(r => r.StaffMemberId == staff[code])?.Total ?? 0;
        return numbers;
    }

    private static async Task<AppointmentDetailDto> CheckedIn(SpaTestHost host, Guid customerId, List<DraftLineRequest> lines)
    {
        var created = await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.CreateAsync(new CreateAppointmentRequest { CustomerId = customerId, Lines = lines }));
        return await host.CallAsync<IAppointmentService, AppointmentDetailDto>(s => s.CheckInAsync(created.Id));
    }

    private static async Task<InvoiceDto> Checkout(
        SpaTestHost host, Guid appointmentId, decimal expected, PaymentMethod method, decimal? cash = null,
        DiscountRequest? discount = null, string? overrideReason = null, List<SellPackageChoice>? sell = null)
    {
        var result = await host.CallAsync<IInvoiceService, CreateResult<InvoiceDto>>(s => s.CheckoutAsync(new CheckoutRequest
        {
            ClientRequestId = Guid.NewGuid().ToString(),
            AppointmentId = appointmentId,
            Discount = discount,
            IntervalOverrideReason = overrideReason,
            Method = method,
            CashReceived = cash,
            SellPackages = sell ?? [],
            ExpectedTotal = expected
        }));
        Assert.True(result.Created);
        return result.Value;
    }

    private static async Task<Exception?> Capture(Task task)
    {
        try
        {
            await task;
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }
}
