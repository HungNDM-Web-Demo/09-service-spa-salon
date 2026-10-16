/** Endpoint BE (QUY-UOC-API §3, docs/07-DANH-SACH-API.md §4). Đường dẫn tương đối, lib/axios.ts ghép với NEXT_PUBLIC_API_URL. */
export const apiRoutes = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    changePassword: '/api/auth/me/password',
  },
  demo: {
    accounts: '/api/demo/accounts',
    loginAs: '/api/demo/login-as',
    reset: '/api/demo/reset',
  },
  users: {
    list: '/api/users',
    detail: (id: string) => `/api/users/${id}`,
    lock: (id: string) => `/api/users/${id}/lock`,
    resetPassword: (id: string) => `/api/users/${id}/reset-password`,
  },
  roles: {
    list: '/api/roles',
    detail: (id: string) => `/api/roles/${id}`,
    permissions: (id: string) => `/api/roles/${id}/permissions`,
  },
  permissions: {
    list: '/api/permissions',
  },
  settings: {
    public: '/api/settings/public',
    list: '/api/settings',
  },
  uploads: {
    images: '/api/uploads/images',
  },
  auditLogs: {
    list: '/api/audit-logs',
  },

  // ───────────────────────────── Nghiệp vụ Spa
  serviceGroups: {
    list: '/api/service-groups',
    detail: (id: string) => `/api/service-groups/${id}`,
    order: '/api/service-groups/order',
  },
  services: {
    list: '/api/services',
    options: '/api/services/options',
    nextCode: '/api/services/next-code',
    detail: (id: string) => `/api/services/${id}`,
    visibility: (id: string) => `/api/services/${id}/visibility`,
  },
  packageTemplates: {
    list: '/api/package-templates',
    options: '/api/package-templates/options',
    nextCode: '/api/package-templates/next-code',
    detail: (id: string) => `/api/package-templates/${id}`,
    status: (id: string) => `/api/package-templates/${id}/status`,
  },
  businessHours: '/api/business-hours',
  storeProfile: '/api/store-profile',
  staffMembers: {
    list: '/api/staff-members',
    options: '/api/staff-members/options',
    accountCandidates: '/api/staff-members/account-candidates',
    nextCode: '/api/staff-members/next-code',
    detail: (id: string) => `/api/staff-members/${id}`,
    shifts: (id: string) => `/api/staff-members/${id}/shifts`,
    status: (id: string) => `/api/staff-members/${id}/status`,
  },
  daysOff: {
    list: '/api/days-off',
    detail: (id: string) => `/api/days-off/${id}`,
  },
  appointments: {
    board: '/api/appointments/board',
    list: '/api/appointments',
    detail: (id: string) => `/api/appointments/${id}`,
    check: '/api/appointments/check',
    suggestions: '/api/appointments/suggestions',
    line: (id: string, lineId: string) => `/api/appointments/${id}/lines/${lineId}`,
    confirm: (id: string) => `/api/appointments/${id}/confirm`,
    reject: (id: string) => `/api/appointments/${id}/reject`,
    cancel: (id: string) => `/api/appointments/${id}/cancel`,
    checkIn: (id: string) => `/api/appointments/${id}/check-in`,
    noShow: (id: string) => `/api/appointments/${id}/no-show`,
    checkout: (id: string) => `/api/appointments/${id}/checkout`,
  },
  publicBooking: {
    catalog: '/api/public/booking/catalog',
    slots: '/api/public/booking/slots',
    book: '/api/public/booking',
    lookup: '/api/public/booking/lookup',
    cancel: '/api/public/booking/cancel',
  },
  invoices: {
    list: '/api/invoices',
    checkout: '/api/invoices/checkout',
    packageSale: '/api/invoices/package-sale',
    detail: (id: string) => `/api/invoices/${id}`,
    cancel: (id: string) => `/api/invoices/${id}/cancel`,
  },
  customerPackages: {
    list: '/api/customer-packages',
    detail: (id: string) => `/api/customer-packages/${id}`,
    extend: (id: string) => `/api/customer-packages/${id}/extend`,
  },
  commissions: {
    sheet: '/api/commissions/sheet',
    items: '/api/commissions/items',
    close: (month: string) => `/api/commissions/${month}/close`,
    pay: (month: string) => `/api/commissions/${month}/pay`,
    my: '/api/commissions/my',
  },
  mySchedule: '/api/my-schedule',
  customers: {
    list: '/api/customers',
    lookup: '/api/customers/lookup',
    detail: (id: string) => `/api/customers/${id}`,
  },
  dashboard: {
    today: '/api/dashboard/today',
  },
  reports: {
    revenue: '/api/reports/revenue',
    services: '/api/reports/services',
    technicians: '/api/reports/technicians',
    packages: '/api/reports/packages',
    cancellations: '/api/reports/cancellations',
  },
} as const
