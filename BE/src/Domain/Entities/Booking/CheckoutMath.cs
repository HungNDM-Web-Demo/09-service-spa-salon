using Domain.Enums.Booking;

namespace Domain.Entities.Booking;

/// <summary>Dòng dịch vụ đem thanh toán. <see cref="UsePackage"/> null = theo mặc định (tự trừ buổi khi có gói hợp lệ).</summary>
public sealed record CheckoutServiceLine(
    Guid LineId,
    Guid ServiceId,
    string ServiceName,
    Guid StaffId,
    string StaffName,
    decimal Price,
    int Duration,
    CommissionType CommissionType,
    decimal CommissionValue,
    bool? UsePackage);

/// <summary>Gói đang có của khách (mọi trạng thái, cùng dịch vụ với lịch).</summary>
public sealed record CheckoutPackage(
    Guid Id,
    string Code,
    Guid ServiceId,
    CustomerPackageStatus Status,
    int Remaining,
    DateOnly ExpiryDate,
    int MinIntervalDays,
    DateOnly? LastUsedDate,
    decimal SessionValue);

/// <summary>Gói bán trong hóa đơn (bán kèm hoặc bán riêng).</summary>
public sealed record CheckoutSale(
    Guid TemplateId,
    string TemplateCode,
    string Name,
    Guid ServiceId,
    string ServiceName,
    int Sessions,
    decimal Price,
    int ValidityMonths,
    int MinIntervalDays,
    decimal CommissionRate,
    Guid ConsultantId,
    string ConsultantName);

public sealed record CheckoutDiscount(DiscountType Type, decimal Value, string? Reason);

public sealed class CheckoutInput
{
    public required IReadOnlyList<CheckoutServiceLine> Lines { get; init; }
    public required IReadOnlyList<CheckoutPackage> Packages { get; init; }
    public IReadOnlyList<CheckoutSale> Sales { get; init; } = [];
    public CheckoutDiscount? Discount { get; init; }
    public required DateOnly PayDate { get; init; }

    /// <summary>0, 10 hoặc 50 theo quyền (07 §3.6 bước 4).</summary>
    public int DiscountLimitPercent { get; init; }
}

/// <summary>Gói bị trừ: gói đang có (<see cref="PackageId"/>) hoặc gói bán trong cùng hóa đơn (<see cref="SaleIndex"/>).</summary>
public sealed record PackageRef(Guid? PackageId, int? SaleIndex, string? Code, int RemainingAfter, DateOnly ExpiryDate, int MinIntervalDays);

public sealed class CheckoutLineResult
{
    public required CheckoutServiceLine Line { get; init; }
    public bool Eligible { get; init; }
    public bool UsesPackage { get; init; }
    public PackageRef? Package { get; init; }
    public decimal Amount { get; init; }
    public decimal BasePrice { get; init; }
    public string? IntervalWarning { get; init; }
    public string? PackageNote { get; init; }
    public decimal Commission { get; init; }
}

public sealed class CheckoutSaleResult
{
    public required CheckoutSale Sale { get; init; }
    public required DateOnly ExpiryDate { get; init; }
    public required decimal SessionValue { get; init; }
    public decimal Commission { get; init; }
    public int UsedInInvoice { get; init; }
}

public sealed class CheckoutResult
{
    public required IReadOnlyList<CheckoutLineResult> Lines { get; init; }
    public required IReadOnlyList<CheckoutSaleResult> Sales { get; init; }
    public decimal ServiceTotal { get; init; }
    public decimal PackageTotal { get; init; }
    public decimal DiscountAmount { get; init; }
    public decimal MaxDiscount { get; init; }
    public decimal Total { get; init; }

    /// <summary>Lỗi theo trường camelCase (giảm giá, dòng đòi trừ buổi mà không có gói).</summary>
    public required IReadOnlyDictionary<string, string> Errors { get; init; }

    /// <summary>Có dòng trừ buổi chưa đủ khoảng cách (BR-19): phải có lý do.</summary>
    public bool RequiresOverrideReason => Lines.Any(l => l.UsesPackage && l.IntervalWarning is not null);
}

/// <summary>Tính hóa đơn (07 §3.5, §3.6): trừ buổi, khoảng cách, giảm giá, tổng tiền, hoa hồng. Thuần; FE <c>checkout.ts</c> giống hệt.</summary>
public static class CheckoutMath
{
    public static CheckoutResult Compute(CheckoutInput input)
    {
        var errors = new Dictionary<string, string>();
        var sales = input.Sales
            .Select(s => new
            {
                Sale = s,
                Expiry = BookingRules.ExpiryDate(input.PayDate, s.ValidityMonths),
                SessionValue = BookingRules.SessionValue(s.Price, s.Sessions)
            })
            .ToList();

        // Trạng thái gói trong lúc phân bổ (còn lại, ngày trừ gần nhất).
        var existing = input.Packages
            .Select(p => new PoolItem(p.Id, null, p.Code, p.ServiceId, p.Status, p.Remaining, p.ExpiryDate, p.MinIntervalDays, p.LastUsedDate, p.SessionValue, 0))
            .ToList();
        var fresh = sales
            .Select((s, i) => new PoolItem(null, i, null, s.Sale.ServiceId, CustomerPackageStatus.DangDung, s.Sale.Sessions, s.Expiry, s.Sale.MinIntervalDays, null, s.SessionValue, 1))
            .ToList();
        var pool = existing.Concat(fresh).ToList();

        var lines = new List<CheckoutLineResult>();
        for (var i = 0; i < input.Lines.Count; i++)
        {
            var line = input.Lines[i];
            var candidate = pool
                .Where(p => p.ServiceId == line.ServiceId && p.Status == CustomerPackageStatus.DangDung && p.Remaining >= 1 && input.PayDate <= p.Expiry)
                .OrderBy(p => p.Expiry)
                .ThenBy(p => p.Order)
                .ThenBy(p => p.Code ?? "~", StringComparer.Ordinal)
                .FirstOrDefault();
            var eligible = candidate is not null;
            var use = line.UsePackage ?? eligible;
            if (use && !eligible)
            {
                errors[$"lines[{i}].usePackage"] = $"Dòng {line.ServiceName} không có gói hợp lệ để trừ buổi";
                use = false;
            }

            string? note = null;
            if (!eligible)
            {
                var unusable = pool.Where(p => p.ServiceId == line.ServiceId && p.PackageId is not null).OrderByDescending(p => p.Expiry).FirstOrDefault();
                if (unusable is not null)
                {
                    note = unusable.Status == CustomerPackageStatus.DaDungHet || unusable.Remaining <= 0
                        ? $"Gói {unusable.Code} đã dùng hết"
                        : unusable.Status is CustomerPackageStatus.HetHan || input.PayDate > unusable.Expiry
                            ? $"Gói {unusable.Code} hết hạn ngày {BookingRules.FormatDate(unusable.Expiry)}"
                            : unusable.Status == CustomerPackageStatus.DaHuy ? $"Gói {unusable.Code} đã hủy" : null;
                }
            }

            if (use && candidate is not null)
            {
                string? warning = null;
                if (candidate.MinIntervalDays > 0 && candidate.LastUsed is { } last)
                {
                    var gap = input.PayDate.DayNumber - last.DayNumber;
                    if (gap < candidate.MinIntervalDays)
                        warning = $"Buổi gần nhất cách {gap} ngày, gói yêu cầu {candidate.MinIntervalDays} ngày";
                }

                candidate.Remaining -= 1;
                candidate.LastUsed = input.PayDate;
                if (candidate.SaleIndex is not null)
                    candidate.UsedInInvoice += 1;
                var basePrice = candidate.SessionValue;
                lines.Add(new CheckoutLineResult
                {
                    Line = line,
                    Eligible = true,
                    UsesPackage = true,
                    Package = new PackageRef(candidate.PackageId, candidate.SaleIndex, candidate.Code, candidate.Remaining, candidate.Expiry, candidate.MinIntervalDays),
                    Amount = 0,
                    BasePrice = basePrice,
                    IntervalWarning = warning,
                    Commission = ServiceCommission(line, basePrice)
                });
            }
            else
            {
                lines.Add(new CheckoutLineResult
                {
                    Line = line,
                    Eligible = eligible,
                    UsesPackage = false,
                    Amount = line.Price,
                    BasePrice = line.Price,
                    PackageNote = note,
                    Commission = ServiceCommission(line, line.Price)
                });
            }
        }

        var serviceTotal = lines.Sum(l => l.Amount);
        var packageTotal = sales.Sum(s => s.Sale.Price);
        var maxDiscount = BookingRules.Floor1000(serviceTotal * input.DiscountLimitPercent / 100m);
        var discountAmount = 0m;
        if (input.Discount is { } discount && discount.Value > 0)
        {
            var roleLabel = input.DiscountLimitPercent >= BookingRules.ManagerDiscountLimitPercent ? "Chủ tiệm" : "Lễ tân";
            var limitMessage = $"{roleLabel} giảm tối đa {input.DiscountLimitPercent}% ({BookingRules.FormatVnd(maxDiscount)})";
            if (input.DiscountLimitPercent <= 0)
            {
                errors["discount.value"] = "Bạn không có quyền giảm giá";
            }
            else if (discount.Type == DiscountType.PhanTram)
            {
                if (discount.Value != Math.Floor(discount.Value) || discount.Value > 100)
                    errors["discount.value"] = "Phần trăm giảm là số nguyên từ 1 đến 100";
                else if (discount.Value > input.DiscountLimitPercent)
                    errors["discount.value"] = limitMessage;
                else
                    discountAmount = BookingRules.Floor1000(serviceTotal * discount.Value / 100m);
            }
            else
            {
                if (discount.Value % 1000 != 0)
                    errors["discount.value"] = "Số tiền giảm là bội số 1.000 ₫";
                else if (discount.Value > maxDiscount)
                    errors["discount.value"] = limitMessage;
                else
                    discountAmount = discount.Value;
            }

            if (!errors.ContainsKey("discount.value") && string.IsNullOrWhiteSpace(discount.Reason))
                errors["discount.reason"] = "Chọn lý do giảm giá";
        }

        var saleResults = sales.Select((s, i) => new CheckoutSaleResult
        {
            Sale = s.Sale,
            ExpiryDate = s.Expiry,
            SessionValue = s.SessionValue,
            Commission = BookingRules.Floor1000(s.Sale.Price * s.Sale.CommissionRate / 100m),
            UsedInInvoice = fresh[i].UsedInInvoice
        }).ToList();

        return new CheckoutResult
        {
            Lines = lines,
            Sales = saleResults,
            ServiceTotal = serviceTotal,
            PackageTotal = packageTotal,
            DiscountAmount = discountAmount,
            MaxDiscount = maxDiscount,
            Total = serviceTotal + packageTotal - discountAmount,
            Errors = errors
        };
    }

    /// <summary>Hoa hồng dịch vụ một dòng (BR-23): phần trăm của giá căn cứ làm tròn xuống 1.000 ₫, hoặc số tiền cố định.</summary>
    public static decimal ServiceCommission(CheckoutServiceLine line, decimal basePrice) =>
        line.CommissionType == CommissionType.PhanTram
            ? BookingRules.Floor1000(basePrice * line.CommissionValue / 100m)
            : line.CommissionValue;

    /// <summary>Hạn mức giảm giá theo quyền (07 §3.6 bước 4).</summary>
    public static int DiscountLimit(bool canDiscount, bool canDiscountHigh) =>
        canDiscountHigh ? BookingRules.ManagerDiscountLimitPercent : canDiscount ? BookingRules.StaffDiscountLimitPercent : 0;

    private sealed class PoolItem(
        Guid? packageId,
        int? saleIndex,
        string? code,
        Guid serviceId,
        CustomerPackageStatus status,
        int remaining,
        DateOnly expiry,
        int minIntervalDays,
        DateOnly? lastUsed,
        decimal sessionValue,
        int order)
    {
        public Guid? PackageId { get; } = packageId;
        public int? SaleIndex { get; } = saleIndex;
        public string? Code { get; } = code;
        public Guid ServiceId { get; } = serviceId;
        public CustomerPackageStatus Status { get; } = status;
        public int Remaining { get; set; } = remaining;
        public DateOnly Expiry { get; } = expiry;
        public int MinIntervalDays { get; } = minIntervalDays;
        public DateOnly? LastUsed { get; set; } = lastUsed;
        public decimal SessionValue { get; } = sessionValue;
        public int Order { get; } = order;
        public int UsedInInvoice { get; set; }
    }
}
