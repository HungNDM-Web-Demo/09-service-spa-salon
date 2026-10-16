using System.Text.Json;
using Domain.Enums.Booking;
using Domain.Enums.Crm;
using Domain.Enums.Hr;

namespace Infrastructure.Persistence.Seeders;

// Hình dạng của FE/src/mock/seed/demo-data.json (06 §5.2, §5.4). Khóa ngắn trong file, đọc không phân biệt hoa thường.

internal sealed class SpaSeedFile
{
    public List<SeedServiceGroup> ServiceGroups { get; init; } = [];
    public List<SeedService> Services { get; init; } = [];
    public List<SeedPackageTemplate> PackageTemplates { get; init; } = [];
    public List<SeedStaff> Staff { get; init; } = [];
    public List<SeedDayOff> DaysOff { get; init; } = [];
    public List<SeedCustomer> Customers { get; init; } = [];
    public List<SeedPackageSale> PackageSales { get; init; } = [];
    public List<SeedAppointment> Appointments { get; init; } = [];
    public List<SeedReserve> Reserve { get; init; } = [];
}

internal sealed class SeedServiceGroup
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public bool? Visible { get; init; }
}

internal sealed class SeedService
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Group { get; init; } = string.Empty;
    public int Dur { get; init; }
    public int Clean { get; init; }
    public decimal Price { get; init; }
    public CommissionType Ct { get; init; }
    public decimal Cv { get; init; }
    public bool Online { get; init; }
    public bool? Visible { get; init; }
    public string? Desc { get; init; }
    public string? Img { get; init; }
}

internal sealed class SeedPackageTemplate
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Service { get; init; } = string.Empty;
    public int Sessions { get; init; }
    public decimal Price { get; init; }
    public int Months { get; init; }
    public int Gap { get; init; }
    public decimal Rate { get; init; }
    public bool? Active { get; init; }
}

internal sealed class SeedStaff
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public StaffKind Kind { get; init; }
    public string Color { get; init; } = "#64748B";
    public string? Specialty { get; init; }
    public string? User { get; init; }
    public List<string> Services { get; init; } = [];

    /// <summary>7 ký tự Thứ Hai → Chủ nhật: S sáng, C chiều, F cả ngày, - nghỉ.</summary>
    public string Week { get; init; } = "-------";
}

/// <summary>Ngày: <see cref="W"/> = [tuần lệch, thứ] hoặc <see cref="D"/> = số ngày lệch so với hôm nay (06 §5.3).</summary>
internal interface ISeedDay
{
    List<int>? W { get; }
    int? D { get; }
}

internal sealed class SeedDayOff : ISeedDay
{
    public string? Staff { get; init; }
    public List<int>? W { get; init; }
    public int? D { get; init; }
    public string Reason { get; init; } = string.Empty;
}

internal sealed class SeedCustomer
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Phone { get; init; } = string.Empty;
    public Gender? G { get; init; }
    public DateOnly? Birth { get; init; }
    public string? Note { get; init; }
    public int Cr { get; init; }
}

internal sealed class SeedPackageSale : ISeedDay
{
    public string Id { get; init; } = string.Empty;
    public string C { get; init; } = string.Empty;
    public string Tpl { get; init; } = string.Empty;
    public List<int>? W { get; init; }
    public int? D { get; init; }
    public string T { get; init; } = "10:00";
    public string By { get; init; } = string.Empty;
    public PaymentMethod M { get; init; }
    public int? Exp { get; init; }
    public bool? Fx { get; init; }
}

internal sealed class SeedAppointment : ISeedDay
{
    public string Id { get; init; } = string.Empty;
    public string C { get; init; } = string.Empty;
    public List<int>? W { get; init; }
    public int? D { get; init; }
    public AppointmentSource Src { get; init; }
    public string? O { get; init; }
    public AppointmentStatus? St { get; init; }

    /// <summary>Dòng [mã dịch vụ, mã NV, giờ "HH:mm" hoặc "~-30"].</summary>
    public List<List<string>> Ln { get; init; } = [];

    public double? Ld { get; init; }
    public int? Cr { get; init; }
    public string? Nt { get; init; }
    public List<string>? Cx { get; init; }
    public SeedPay? Pay { get; init; }
    public bool? Fx { get; init; }
}

internal sealed class SeedPay
{
    public PaymentMethod M { get; init; }

    /// <summary>[kiểu, giá trị, lý do].</summary>
    public List<JsonElement>? Disc { get; init; }

    /// <summary>[[mã gói mẫu, mã NV tư vấn]].</summary>
    public List<List<string>>? Sell { get; init; }

    public string? Ovr { get; init; }
    public string? By { get; init; }
}

internal sealed class SeedReserve
{
    public List<string> Staff { get; init; } = [];
    public int? D { get; init; }
    public string? Day { get; init; }
    public string? From { get; init; }
}
