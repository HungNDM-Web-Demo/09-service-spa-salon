/** Đường dẫn FE (kebab-case, docs/07-DANH-SACH-API.md §6). Không gõ đường dẫn trực tiếp trong component. */
export const routePath = {
  root: '/',
  login: '/login',
  forbidden: '/forbidden',
  profile: '/profile',

  dashboard: '/dashboard',
  appointments: '/appointments',
  appointmentDetail: (id: string) => `/appointments/${id}`,
  services: '/services',
  packages: '/packages',
  staff: '/staff',
  commissions: '/commissions',
  mySchedule: '/my-schedule',
  customers: '/customers',
  reports: '/reports',
  printInvoices: '/print/invoices',
  invoicePrint: (id: string) => `/print/invoices/${id}`,
  booking: '/dat-lich',
  bookingLookup: '/dat-lich/tra-cuu',

  settingsUsers: '/settings/users',
  settingsRoles: '/settings/roles',
  settingsGeneral: '/settings/general',
  settingsAuditLogs: '/settings/audit-logs',
} as const

type Paths = typeof routePath
export type RoutePath = { [K in keyof Paths]: Paths[K] extends string ? Paths[K] : never }[keyof Paths]
