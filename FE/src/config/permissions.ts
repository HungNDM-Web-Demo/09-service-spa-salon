/**
 * Mã quyền, khai báo giống hệt BE `Application/Constants/Permissions.cs` (nền) + `ProjectPermissions.cs` (nghiệp vụ)
 * và danh sách seed `src/mock/seed/system.json` + project.json (docs/07-DANH-SACH-API.md §1).
 * Định dạng `{resource}.{action}`. Không gõ chuỗi mã quyền trực tiếp trong component.
 */
export const permissions = {
  dashboard: {
    view: 'dashboard.view',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
  },
  roles: {
    view: 'roles.view',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
  },
  settings: {
    view: 'settings.view',
    update: 'settings.update',
  },
  auditLogs: {
    view: 'audit-logs.view',
  },
  services: {
    view: 'services.view',
    create: 'services.create',
    update: 'services.update',
    delete: 'services.delete',
  },
  staffMembers: {
    view: 'staff-members.view',
    create: 'staff-members.create',
    update: 'staff-members.update',
    delete: 'staff-members.delete',
  },
  appointments: {
    view: 'appointments.view',
    viewOwn: 'appointments.view-own',
    create: 'appointments.create',
    update: 'appointments.update',
    cancel: 'appointments.cancel',
  },
  invoices: {
    create: 'invoices.create',
    discount: 'invoices.discount',
    discountHigh: 'invoices.discount-high',
    cancel: 'invoices.cancel',
  },
  packages: {
    view: 'packages.view',
    create: 'packages.create',
    update: 'packages.update',
    delete: 'packages.delete',
  },
  customerPackages: {
    view: 'customer-packages.view',
    sell: 'customer-packages.sell',
    extend: 'customer-packages.extend',
  },
  commissions: {
    view: 'commissions.view',
    viewOwn: 'commissions.view-own',
    close: 'commissions.close',
  },
  customers: {
    view: 'customers.view',
    create: 'customers.create',
    update: 'customers.update',
  },
  reports: {
    view: 'reports.view',
  },
} as const

/** Mã vai trò hệ thống (BR-SYS-06) và vai trò riêng của dự án. */
export const roleCodes = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  staff: 'STAFF',
  technician: 'TECHNICIAN',
} as const

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T]
export type PermissionCode = Leaves<typeof permissions>
