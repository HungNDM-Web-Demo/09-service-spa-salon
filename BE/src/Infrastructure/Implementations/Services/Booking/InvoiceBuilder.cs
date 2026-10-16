using Application.Common.Time;
using Domain.Entities.Booking;
using Domain.Entities.Booking.Appointments;
using Domain.Entities.Booking.CustomerPackages;
using Domain.Entities.Booking.Invoices;
using Domain.Entities.Booking.PackageTemplates;
using Domain.Entities.Crm.Customers;
using Domain.Entities.Hr.Commissions;
using Domain.Enums.Booking;
using Domain.Enums.Hr;

namespace Infrastructure.Implementations.Services.Booking;

/// <summary>Dòng dịch vụ đem thanh toán, kèm mức hoa hồng hiện hành của dịch vụ (BR-23).</summary>
internal sealed record CheckoutLineSource(AppointmentLine Line, string StaffName, CommissionType CommissionType, decimal CommissionValue);

/// <summary>Gói bán trong hóa đơn: gói mẫu, tên dịch vụ, người tư vấn.</summary>
internal sealed record CheckoutSaleSource(PackageTemplate Template, string ServiceName, Guid ConsultantId, string ConsultantName);

/// <summary>Đầu vào dựng hóa đơn; không đọc DB nên dùng chung cho service và seeder (06 §5.5 bước 4).</summary>
internal sealed class CheckoutDraft
{
    public Appointment? Appointment { get; init; }
    public required Customer Customer { get; init; }
    public IReadOnlyList<CheckoutLineSource> Lines { get; init; } = [];
    public IReadOnlyDictionary<Guid, bool>? UsePackage { get; init; }

    /// <summary>Gói của khách (entity đang theo dõi hoặc trong bộ nhớ) dùng được cho các dịch vụ của hóa đơn.</summary>
    public IReadOnlyList<CustomerPackage> Packages { get; init; } = [];

    /// <summary>Ngày trừ buổi gần nhất chưa hoàn trả của gói (giờ Việt Nam).</summary>
    public required Func<Guid, DateOnly?> LastUsedDate { get; init; }

    public IReadOnlyList<CheckoutSaleSource> Sales { get; init; } = [];
    public CheckoutDiscount? Discount { get; init; }
    public int DiscountLimitPercent { get; init; }
    public PaymentMethod Method { get; init; }
    public decimal? CashReceived { get; init; }
    public string? CardAuthCode { get; init; }
    public string? OverrideReason { get; init; }
    public required DateTime Now { get; init; }
    public required string CashierName { get; init; }
    public string? ClientRequestId { get; init; }
}

internal sealed class CheckoutOutcome
{
    public required Invoice Invoice { get; init; }
    public required List<CustomerPackage> NewPackages { get; init; }
    public required List<PackageUsage> Usages { get; init; }
    public required List<Commission> Commissions { get; init; }
}

/// <summary>
/// Tính và dựng hóa đơn (07 §3.6) bằng <see cref="CheckoutMath"/>: hóa đơn, dòng, gói bán kèm, lần trừ buổi, hoa hồng;
/// cập nhật gói bị trừ, trạng thái lịch hẹn. Không lưu DB.
/// </summary>
internal static class InvoiceBuilder
{
    public static CheckoutResult Compute(CheckoutDraft draft) =>
        CheckoutMath.Compute(new CheckoutInput
        {
            Lines = draft.Lines.Select(l => new CheckoutServiceLine(
                l.Line.Id, l.Line.ServiceId, l.Line.ServiceName, l.Line.StaffMemberId, l.StaffName, l.Line.Price, l.Line.DurationMinutes,
                l.CommissionType, l.CommissionValue,
                draft.UsePackage is not null && draft.UsePackage.TryGetValue(l.Line.Id, out var use) ? use : null)).ToList(),
            Packages = draft.Packages.Select(p => new CheckoutPackage(
                p.Id, p.Code, p.ServiceId, p.Status, p.Remaining, p.ExpiryDate, p.MinIntervalDays, draft.LastUsedDate(p.Id), p.SessionValue)).ToList(),
            Sales = draft.Sales.Select(s => new CheckoutSale(
                s.Template.Id, s.Template.Code, s.Template.Name, s.Template.ServiceId, s.ServiceName, s.Template.Sessions, s.Template.Price,
                s.Template.ValidityMonths, s.Template.MinIntervalDays, s.Template.CommissionRate, s.ConsultantId, s.ConsultantName)).ToList(),
            Discount = draft.Discount,
            PayDate = VietnamDates.DateOf(draft.Now),
            DiscountLimitPercent = draft.DiscountLimitPercent
        });

    /// <summary>Lỗi phương thức thanh toán (BR-17) theo trường camelCase; tổng 0 ₫ không cần phương thức (BR-15).</summary>
    public static Dictionary<string, string> PaymentErrors(decimal total, PaymentMethod method, decimal? cashReceived, string? cardAuthCode)
    {
        var errors = new Dictionary<string, string>();
        if (total <= 0)
            return errors;
        switch (method)
        {
            case PaymentMethod.TienMat:
                if (cashReceived is null || cashReceived < total)
                    errors["cashReceived"] = $"Tiền khách đưa chưa đủ, còn thiếu {BookingRules.FormatVnd(total - (cashReceived ?? 0))}";
                break;
            case PaymentMethod.The:
                if (cardAuthCode is null || cardAuthCode.Length != 6 || !cardAuthCode.All(char.IsAsciiDigit))
                    errors["cardAuthCode"] = "Mã chuẩn chi gồm 6 chữ số";
                break;
            case PaymentMethod.ChuyenKhoan:
                break;
            default:
                errors["method"] = "Chọn phương thức thanh toán";
                break;
        }

        return errors;
    }

    public static CheckoutOutcome Apply(CheckoutDraft draft, CheckoutResult result, Func<string, string> nextCode)
    {
        var payDate = VietnamDates.DateOf(draft.Now);
        var month = BookingRules.MonthKey(payDate);
        var invoice = new Invoice
        {
            Code = nextCode(BookingRules.InvoicePrefix),
            AppointmentId = draft.Appointment?.Id,
            CustomerId = draft.Customer.Id,
            PaidAt = draft.Now,
            CashierName = draft.CashierName,
            ServiceTotal = result.ServiceTotal,
            PackageTotal = result.PackageTotal,
            DiscountType = result.DiscountAmount > 0 ? draft.Discount?.Type : null,
            DiscountValue = result.DiscountAmount > 0 ? draft.Discount?.Value ?? 0 : 0,
            DiscountAmount = result.DiscountAmount,
            DiscountReason = result.DiscountAmount > 0 ? draft.Discount?.Reason?.Trim() : null,
            Total = result.Total,
            Method = result.Total <= 0 ? PaymentMethod.KhongThu : draft.Method,
            IntervalOverrideReason = result.RequiresOverrideReason ? draft.OverrideReason?.Trim() : null,
            Status = InvoiceStatus.DaThanhToan,
            ClientRequestId = string.IsNullOrWhiteSpace(draft.ClientRequestId) ? null : draft.ClientRequestId.Trim()
        };
        invoice.SetCreatedAt(draft.Now);
        if (invoice.Method == PaymentMethod.TienMat)
        {
            invoice.CashReceived = draft.CashReceived;
            invoice.ChangeAmount = draft.CashReceived - result.Total;
        }
        else if (invoice.Method == PaymentMethod.The)
        {
            invoice.CardAuthCode = draft.CardAuthCode;
        }

        // Gói bán kèm tạo trước để dòng dịch vụ trừ buổi được ngay (BR-21).
        var newPackages = result.Sales.Select(s =>
        {
            var package = new CustomerPackage
            {
                Code = nextCode(BookingRules.PackagePrefix),
                CustomerId = draft.Customer.Id,
                PackageTemplateId = s.Sale.TemplateId,
                PackageName = s.Sale.Name,
                ServiceId = s.Sale.ServiceId,
                ServiceName = s.Sale.ServiceName,
                TotalSessions = s.Sale.Sessions,
                UsedSessions = 0,
                Price = s.Sale.Price,
                SessionValue = s.SessionValue,
                MinIntervalDays = s.Sale.MinIntervalDays,
                CommissionRate = s.Sale.CommissionRate,
                PurchasedAt = draft.Now,
                ExpiryDate = s.ExpiryDate,
                ConsultantStaffId = s.Sale.ConsultantId,
                ConsultantName = s.Sale.ConsultantName,
                InvoiceId = invoice.Id,
                Status = CustomerPackageStatus.DangDung
            };
            package.SetCreatedAt(draft.Now);
            return package;
        }).ToList();

        var usages = new List<PackageUsage>();
        var commissions = new List<Commission>();
        var order = 0;
        foreach (var line in result.Lines)
        {
            var invoiceLine = new InvoiceLine
            {
                InvoiceId = invoice.Id,
                Kind = InvoiceLineKind.DichVu,
                SortOrder = ++order,
                AppointmentLineId = line.Line.LineId,
                ServiceId = line.Line.ServiceId,
                Description = line.Line.ServiceName,
                StaffMemberId = line.Line.StaffId,
                StaffName = line.Line.StaffName,
                DurationMinutes = line.Line.Duration,
                ListPrice = line.Line.Price,
                UsesPackage = line.UsesPackage,
                Amount = line.Amount,
                BasePrice = line.BasePrice
            };

            if (line.UsesPackage && line.Package is { } pref)
            {
                var package = pref.PackageId is { } pid
                    ? draft.Packages.First(p => p.Id == pid)
                    : newPackages[pref.SaleIndex!.Value];
                package.UsedSessions += 1;
                if (package.Remaining <= 0)
                    package.Status = CustomerPackageStatus.DaDungHet;
                invoiceLine.CustomerPackageId = package.Id;
                invoiceLine.PackageCode = package.Code;
                invoiceLine.PackageRemaining = package.Remaining;
                invoiceLine.PackageExpiryDate = package.ExpiryDate;
                usages.Add(new PackageUsage
                {
                    CustomerPackageId = package.Id,
                    InvoiceId = invoice.Id,
                    InvoiceLineId = invoiceLine.Id,
                    AppointmentId = draft.Appointment?.Id,
                    AppointmentCode = draft.Appointment?.Code,
                    UsedAt = draft.Now,
                    StaffMemberId = line.Line.StaffId,
                    StaffName = line.Line.StaffName,
                    OverrideReason = line.IntervalWarning is not null ? draft.OverrideReason?.Trim() : null
                });
            }

            invoice.Lines.Add(invoiceLine);
            commissions.Add(new Commission
            {
                StaffMemberId = line.Line.StaffId,
                Kind = CommissionKind.DichVu,
                InvoiceId = invoice.Id,
                InvoiceLineId = invoiceLine.Id,
                AppointmentId = draft.Appointment?.Id,
                InvoiceCode = invoice.Code,
                CustomerName = draft.Customer.FullName,
                Description = line.Line.ServiceName,
                Month = month,
                EarnedAt = draft.Now,
                BaseAmount = line.BasePrice,
                RateType = line.Line.CommissionType,
                RateValue = line.Line.CommissionValue,
                Amount = line.Commission
            });
        }

        for (var i = 0; i < result.Sales.Count; i++)
        {
            var sale = result.Sales[i];
            var package = newPackages[i];
            var invoiceLine = new InvoiceLine
            {
                InvoiceId = invoice.Id,
                Kind = InvoiceLineKind.BanGoi,
                SortOrder = ++order,
                ServiceId = sale.Sale.ServiceId,
                PackageTemplateId = sale.Sale.TemplateId,
                CustomerPackageId = package.Id,
                Description = sale.Sale.Name,
                StaffMemberId = sale.Sale.ConsultantId,
                StaffName = sale.Sale.ConsultantName,
                ListPrice = sale.Sale.Price,
                Amount = sale.Sale.Price,
                BasePrice = sale.Sale.Price,
                PackageCode = package.Code,
                PackageRemaining = package.Remaining,
                PackageExpiryDate = package.ExpiryDate
            };
            invoice.Lines.Add(invoiceLine);
            commissions.Add(new Commission
            {
                StaffMemberId = sale.Sale.ConsultantId,
                Kind = CommissionKind.BanGoi,
                InvoiceId = invoice.Id,
                InvoiceLineId = invoiceLine.Id,
                AppointmentId = draft.Appointment?.Id,
                InvoiceCode = invoice.Code,
                CustomerName = draft.Customer.FullName,
                Description = sale.Sale.Name,
                Month = month,
                EarnedAt = draft.Now,
                BaseAmount = sale.Sale.Price,
                RateType = CommissionType.PhanTram,
                RateValue = sale.Sale.CommissionRate,
                Amount = sale.Commission
            });
        }

        if (draft.Appointment is { } appointment)
        {
            appointment.Status = AppointmentStatus.HoanThanh;
            appointment.CompletedAt = draft.Now;
        }

        return new CheckoutOutcome { Invoice = invoice, NewPackages = newPackages, Usages = usages, Commissions = commissions };
    }
}
