namespace Application.Constants;

/// <summary>
/// Mã quyền nghiệp vụ Spa (02-SRS §7, 07-DANH-SACH-API §1). Tách khỏi <see cref="Permissions"/> (quyền nền) để không sửa
/// file nền. Mỗi mã phải có trong FE/src/mock/seed/project.json và FE src/config/permissions.ts; test
/// <c>ProjectPermissionTests</c> kiểm tra việc này.
/// </summary>
public static class ProjectPermissions
{
    public static class Services
    {
        public const string View = "services.view";
        public const string Create = "services.create";
        public const string Update = "services.update";
        public const string Delete = "services.delete";
    }

    public static class StaffMembers
    {
        public const string View = "staff-members.view";
        public const string Create = "staff-members.create";
        public const string Update = "staff-members.update";
        public const string Delete = "staff-members.delete";
    }

    public static class Appointments
    {
        public const string View = "appointments.view";
        public const string ViewOwn = "appointments.view-own";
        public const string Create = "appointments.create";
        public const string Update = "appointments.update";
        public const string Cancel = "appointments.cancel";
    }

    public static class Invoices
    {
        public const string Create = "invoices.create";
        public const string Discount = "invoices.discount";
        public const string DiscountHigh = "invoices.discount-high";
        public const string Cancel = "invoices.cancel";
    }

    public static class Packages
    {
        public const string View = "packages.view";
        public const string Create = "packages.create";
        public const string Update = "packages.update";
        public const string Delete = "packages.delete";
    }

    public static class CustomerPackages
    {
        public const string View = "customer-packages.view";
        public const string Sell = "customer-packages.sell";
        public const string Extend = "customer-packages.extend";
    }

    public static class Commissions
    {
        public const string View = "commissions.view";
        public const string ViewOwn = "commissions.view-own";
        public const string Close = "commissions.close";
    }

    public static class Customers
    {
        public const string View = "customers.view";
        public const string Create = "customers.create";
        public const string Update = "customers.update";
    }

    public static class Reports
    {
        public const string View = "reports.view";
    }
}

/// <summary>Vai trò riêng của dự án (khai báo ở project.json).</summary>
public static class ProjectRoleCodes
{
    /// <summary>Kỹ thuật viên: xem lịch và hoa hồng của mình.</summary>
    public const string Technician = "TECHNICIAN";
}
