using System.Reflection;
using System.Text.RegularExpressions;
using Application.Constants;
using Infrastructure.Persistence.Seeders;

namespace UnitTests.Spa;

/// <summary>
/// Mã quyền nghiệp vụ (07 §1) khai báo đủ ba nơi: <see cref="ProjectPermissions"/>, FE/src/mock/seed/project.json (qua
/// <see cref="SystemSeedData"/>) và FE src/config/permissions.ts; vai trò mặc định đúng bảng phân quyền SRS §7.
/// </summary>
public sealed partial class ProjectPermissionTests
{
    private static readonly IReadOnlyList<string> Codes = typeof(ProjectPermissions)
        .GetNestedTypes(BindingFlags.Public | BindingFlags.Static)
        .SelectMany(t => t.GetFields(BindingFlags.Public | BindingFlags.Static))
        .Where(f => f is { IsLiteral: true } && f.FieldType == typeof(string))
        .Select(f => (string)f.GetRawConstantValue()!)
        .ToList();

    [Fact]
    public void Ma_quyen_co_trong_seed()
    {
        var seeded = SystemSeedData.Embedded.Permissions.Select(p => p.Code).ToHashSet();
        Assert.All(Codes, c => Assert.Contains(c, seeded));
        Assert.Equal(31, Codes.Count);
    }

    [Fact]
    public void Ma_quyen_co_trong_permissions_ts()
    {
        var file = Path.Combine(FindRepoRoot(), "FE", "src", "config", "permissions.ts");
        var text = File.ReadAllText(file);
        var declared = QuotedCode().Matches(text).Select(m => m.Groups[1].Value).ToHashSet();
        Assert.All(Codes, c => Assert.Contains(c, declared));
    }

    [Theory]
    [InlineData("TECHNICIAN", "services.view,appointments.view-own,commissions.view-own")]
    public void Vai_tro_ky_thuat_vien_chi_xem_lich_hoa_hong_cua_minh(string role, string expected)
    {
        var permissions = SystemSeedData.Embedded.Roles.Single(r => r.Code == role).Permissions;
        Assert.Equal(expected.Split(',').Order(), permissions.Order());
    }

    [Fact]
    public void Le_tan_khong_giam_gia_lon_khong_huy_hoa_don()
    {
        var staff = SystemSeedData.Embedded.Roles.Single(r => r.Code == RoleCodes.Staff).Permissions;
        Assert.Contains(ProjectPermissions.Invoices.Discount, staff);
        Assert.DoesNotContain(ProjectPermissions.Invoices.DiscountHigh, staff);
        Assert.DoesNotContain(ProjectPermissions.Invoices.Cancel, staff);
        Assert.DoesNotContain(ProjectPermissions.Commissions.View, staff);
        Assert.DoesNotContain(ProjectPermissions.Reports.View, staff);
        var manager = SystemSeedData.Embedded.Roles.Single(r => r.Code == RoleCodes.Manager).Permissions;
        Assert.Contains(ProjectPermissions.Invoices.DiscountHigh, manager);
        Assert.DoesNotContain(ProjectPermissions.Appointments.ViewOwn, manager);
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "FE", "src")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new DirectoryNotFoundException("Không tìm thấy thư mục dự án chứa FE/src.");
    }

    [GeneratedRegex(@"'([a-z\-]+\.[a-z\-]+)'")]
    private static partial Regex QuotedCode();
}
