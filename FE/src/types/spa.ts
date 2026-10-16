/**
 * Kiểu dữ liệu nghiệp vụ Spa, khớp từng trường DTO của BE (docs/07-DANH-SACH-API.md §2, §5).
 * Thời điểm là chuỗi ISO UTC; ngày "yyyy-MM-dd" theo giờ Việt Nam; tiền là number (đồng).
 */
import type { PaginationQuery } from './api'

// ───────────────────────────── Enum (07 §2.1)

export type CommissionType = 'PhanTram' | 'CoDinh'
export type StaffKind = 'KyThuatVien' | 'LeTan'
export type ShiftType = 'Sang' | 'Chieu' | 'CaNgay' | 'Nghi'
export type AppointmentStatus = 'ChoXacNhan' | 'DaXacNhan' | 'DangPhucVu' | 'HoanThanh' | 'DaHuy' | 'KhongDen'
export type AppointmentSource = 'Online' | 'DienThoai' | 'VangLai' | 'ZaloFacebook'
export type CancelReason = 'KhachBaoHuy' | 'TiemDoiLich' | 'HetCho' | 'KhongLienLacDuoc' | 'KhachTuHuy' | 'Khac'
export type Gender = 'Nu' | 'Nam' | 'Khac'
export type InvoiceStatus = 'DaThanhToan' | 'DaHuy'
export type PaymentMethod = 'TienMat' | 'ChuyenKhoan' | 'The' | 'KhongThu'
export type DiscountType = 'PhanTram' | 'SoTien'
export type InvoiceLineKind = 'DichVu' | 'BanGoi'
export type CustomerPackageStatus = 'DangDung' | 'DaDungHet' | 'HetHan' | 'DaHuy'
export type CommissionKind = 'DichVu' | 'BanGoi'
export type CommissionPeriodStatus = 'TamTinh' | 'DaChot' | 'DaChiTra'
export type MessageKind = 'XacNhan' | 'DoiLich' | 'Huy' | 'Nhac'
export type MessageChannel = 'Zalo' | 'Sms'

export type Issue = { code: string; message: string }

// ───────────────────────────── Danh mục (07 §4.1–4.3)

export type ServiceGroupDto = { id: string; name: string; sortOrder: number; isVisible: boolean; serviceCount: number }
export type SaveServiceGroupInput = { name: string; isVisible: boolean }

export type ServiceDto = {
  id: string
  code: string
  name: string
  groupId: string
  groupName: string
  durationMinutes: number
  cleanupMinutes: number
  price: number
  description: string | null
  imageUrl: string | null
  allowOnline: boolean
  commissionType: CommissionType
  commissionValue: number
  isVisible: boolean
  technicianCount: number
  onlineWarning: string | null
  createdAt: string
}

export type SaveServiceInput = {
  code: string
  name: string
  groupId: string
  durationMinutes: number
  cleanupMinutes: number
  price: number
  description?: string | null
  imageUrl?: string | null
  allowOnline: boolean
  commissionType: CommissionType
  commissionValue: number
  isVisible: boolean
}

export type ServiceOption = {
  id: string
  code: string
  name: string
  groupId: string
  groupName: string
  durationMinutes: number
  cleanupMinutes: number
  price: number
  technicianIds: string[]
}

export type NextCodeDto = { code: string }

export type PackageTemplateDto = {
  id: string
  code: string
  name: string
  serviceId: string
  serviceCode: string
  serviceName: string
  servicePrice: number
  sessions: number
  price: number
  validityMonths: number
  minIntervalDays: number
  commissionRate: number
  isActive: boolean
  retailEquivalent: number
  savingAmount: number
  savingPercent: number
  sessionValue: number
  soldCount: number
}

export type SavePackageTemplateInput = {
  code: string
  name: string
  serviceId: string
  sessions: number
  price: number
  validityMonths: number
  minIntervalDays: number
  commissionRate: number
  isActive: boolean
}

export type BusinessHoursDto = { openTime: string; closeTime: string }

/** Thông tin tiệm (Store.*) cho bản in hóa đơn và QR chuyển khoản */
export type StoreProfileDto = {
  name: string
  address: string
  hotline: string
  logoUrl: string | null
  bankBin: string
  bankAccount: string
  bankAccountName: string
}

export type StaffMemberDto = {
  id: string
  code: string
  fullName: string
  phone: string
  kind: StaffKind
  color: string
  specialty: string | null
  userId: string | null
  username: string | null
  isActive: boolean
  sortOrder: number
  serviceIds: string[]
  /** 7 phần tử, Thứ Hai → Chủ nhật */
  shifts: ShiftType[]
}

export type SaveStaffMemberInput = {
  code: string
  fullName: string
  phone: string
  kind: StaffKind
  color: string
  specialty?: string | null
  userId?: string | null
  serviceIds: string[]
  shifts?: ShiftType[]
}

export type StaffOption = { id: string; code: string; fullName: string; kind: StaffKind; color: string }

export type AccountCandidate = {
  id: string
  username: string
  fullName: string
  roles: string[]
  linkedStaffId: string | null
  linkedStaffName: string | null
}

export type AffectedAppointment = {
  appointmentId: string
  code: string
  date: string
  startAt: string
  endAt: string
  customerName: string
  serviceName: string
  staffName: string
  status: AppointmentStatus
}

export type DayOffDto = { id: string; staffMemberId: string | null; staffName: string | null; date: string; reason: string }
export type CreateDayOffInput = { staffMemberId?: string | null; date: string; reason: string }

// ───────────────────────────── Khách hàng (07 §4.9)

export type CustomerDto = {
  id: string
  code: string
  phone: string
  fullName: string
  birthDate: string | null
  gender: Gender | null
  note: string | null
  createdAt: string
  noShowCount90: number
  isFlagged: boolean
  totalSpent: number
  visitCount: number
  lastVisitAt: string | null
  activePackageCount: number
}

export type CustomerQuery = PaginationQuery & { flagged?: boolean; hasActivePackage?: boolean }

export type SaveCustomerInput = {
  phone: string
  fullName: string
  birthDate?: string | null
  gender?: Gender | null
  note?: string | null
}

export type CustomerPackageBrief = {
  id: string
  code: string
  packageName: string
  serviceId: string
  serviceName: string
  totalSessions: number
  remaining: number
  expiryDate: string
  status: CustomerPackageStatus
  sessionValue: number
  minIntervalDays: number
  lastUsedAt: string | null
  purchasedAt: string
}

export type CustomerLookupDto = { customer: CustomerDto | null; packages: CustomerPackageBrief[] }

// ───────────────────────────── Lịch hẹn (07 §4.4)

export type AppointmentLineDto = {
  id: string
  serviceId: string
  serviceName: string
  staffMemberId: string
  staffName: string
  staffColor: string
  startAt: string
  endAt: string
  durationMinutes: number
  cleanupMinutes: number
  price: number
  sortOrder: number
}

export type AppointmentCardDto = {
  id: string
  code: string
  status: AppointmentStatus
  source: AppointmentSource
  customerId: string
  customerName: string
  customerPhone: string
  isFlagged: boolean
  note: string | null
  createdAt: string
  checkedInAt: string | null
  startAt: string
  endAt: string
  isLate: boolean
  pendingOverdue: boolean
  lines: AppointmentLineDto[]
}

export type BoardTechnician = {
  id: string
  code: string
  fullName: string
  color: string
  shift: ShiftType | null
  shiftStart: number | null
  shiftEnd: number | null
  offReason: string | null
  serviceIds: string[]
}

export type BoardDto = {
  date: string
  openMinute: number
  closeMinute: number
  shopClosedReason: string | null
  technicians: BoardTechnician[]
  appointments: AppointmentCardDto[]
}

export type MessageDto = { id: string; kind: MessageKind; channel: MessageChannel; content: string; sentAt: string }

export type InvoiceBrief = {
  id: string
  code: string
  paidAt: string
  total: number
  method: PaymentMethod
  status: InvoiceStatus
  canCancel: boolean
  cancelBlockedReason: string | null
}

export type AppointmentActions = {
  canEdit: boolean
  canConfirm: boolean
  canReject: boolean
  canCancel: boolean
  canCheckIn: boolean
  canNoShow: boolean
  canCheckout: boolean
}

export type AppointmentDetailDto = AppointmentCardDto & {
  date: string
  customer: CustomerDto
  packages: CustomerPackageBrief[]
  createdByName: string | null
  confirmedAt: string | null
  confirmedByName: string | null
  checkedInByName: string | null
  cancelReason: CancelReason | null
  cancelNote: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  noShowAt: string | null
  noShowByName: string | null
  completedAt: string | null
  messages: MessageDto[]
  invoices: InvoiceBrief[]
  actions: AppointmentActions
}

export type AppointmentListItem = {
  id: string
  code: string
  date: string
  startAt: string
  endAt: string
  status: AppointmentStatus
  source: AppointmentSource
  customerId: string
  customerName: string
  customerPhone: string
  services: string
  staffNames: string
  amount: number
  createdAt: string
}

export type AppointmentQuery = PaginationQuery & {
  customerId?: string
  from?: string
  to?: string
  status?: AppointmentStatus
}

export type DraftLineInput = { lineId?: string; serviceId: string; staffMemberId: string; startAt: string }
export type CheckAppointmentInput = { appointmentId?: string; customerId?: string; lines: DraftLineInput[] }
export type LineCheckDto = { index: number; startAt: string; endAt: string; blockEndAt: string; issues: Issue[] }
export type CheckResultDto = { ok: boolean; lines: LineCheckDto[]; issues: Issue[] }

export type CreateAppointmentInput = {
  customerId?: string
  newCustomer?: { phone: string; fullName: string }
  source: AppointmentSource
  note?: string | null
  lines: DraftLineInput[]
}

export type UpdateAppointmentInput = { source?: AppointmentSource; note?: string | null; lines: DraftLineInput[] }
export type MoveLineInput = { staffMemberId: string; startAt: string }
export type CancelAppointmentInput = { reason: CancelReason; note?: string | null }
export type SuggestionQuery = { serviceId: string; staffMemberId: string; startAt: string; appointmentId?: string }
export type SuggestionsDto = { freeTechnicians: StaffOption[]; nextSlots: string[] }

// ───────────────────────────── Đặt lịch online (07 §4.5)

export type PublicCatalogDto = {
  shop: { name: string; address: string; hotline: string; logoUrl: string | null }
  openTime: string
  closeTime: string
  groups: {
    id: string
    name: string
    services: {
      id: string
      code: string
      name: string
      description: string | null
      imageUrl: string | null
      durationMinutes: number
      price: number
    }[]
  }[]
  technicians: { id: string; fullName: string; specialty: string | null; color: string; serviceIds: string[] }[]
}

export type PublicSlotsQuery = { serviceIds: string[]; staffMemberId?: string | null; date: string }
export type PublicSlotsDto = { date: string; slots: string[]; nextAvailableDate: string | null; closedReason: string | null }

export type PublicBookingInput = {
  serviceIds: string[]
  staffMemberId?: string | null
  startAt: string
  fullName: string
  phone: string
  note?: string | null
}

export type PublicAppointmentDto = {
  code: string
  status: AppointmentStatus
  date: string
  startAt: string
  endAt: string
  total: number
  phoneMasked: string
  customerName: string
  canCancel: boolean
  hotline: string
  lines: { serviceName: string; staffName: string; startAt: string; endAt: string; price: number }[]
}

// ───────────────────────────── Thanh toán, hóa đơn, gói (07 §4.6, §4.7)

export type CustomerRef = { id: string; code: string; fullName: string; phone: string }

export type CheckoutPreviewLine = {
  appointmentLineId: string
  serviceId: string
  serviceName: string
  staffMemberId: string
  staffName: string
  price: number
  durationMinutes: number
  commissionType: CommissionType
  commissionValue: number
}

export type CheckoutPreviewDto = {
  appointmentId: string
  appointmentCode: string
  status: AppointmentStatus
  customer: CustomerRef
  lines: CheckoutPreviewLine[]
  packages: CustomerPackageBrief[]
  discountLimitPercent: number
  today: string
}

export type CheckoutInput = {
  clientRequestId: string
  appointmentId: string
  lines: { appointmentLineId: string; usePackage: boolean }[]
  sellPackages: { packageTemplateId: string; consultantStaffId: string }[]
  discount?: { type: DiscountType; value: number; reason: string | null } | null
  intervalOverrideReason?: string | null
  method: PaymentMethod
  cashReceived?: number | null
  cardAuthCode?: string | null
  expectedTotal: number
}

export type PackageSaleInput = {
  clientRequestId: string
  customerId?: string | null
  packageTemplateId: string
  consultantStaffId?: string | null
  method: PaymentMethod
  cashReceived?: number | null
  cardAuthCode?: string | null
  expectedTotal: number
}

export type InvoiceLineDto = {
  id: string
  kind: InvoiceLineKind
  description: string
  staffName: string
  durationMinutes: number
  listPrice: number
  usesPackage: boolean
  amount: number
  basePrice: number
  packageCode: string | null
  packageRemaining: number | null
  packageExpiryDate: string | null
  commissionAmount: number
}

export type InvoiceDto = {
  id: string
  code: string
  appointmentId: string | null
  appointmentCode: string | null
  customer: CustomerRef
  paidAt: string
  cashierName: string
  serviceTotal: number
  packageTotal: number
  discountType: DiscountType | null
  discountValue: number
  discountAmount: number
  discountReason: string | null
  total: number
  method: PaymentMethod
  cashReceived: number | null
  changeAmount: number | null
  cardAuthCode: string | null
  intervalOverrideReason: string | null
  status: InvoiceStatus
  cancelReason: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  canCancel: boolean
  cancelBlockedReason: string | null
  lines: InvoiceLineDto[]
}

export type InvoiceQuery = PaginationQuery & { customerId?: string; from?: string; to?: string }

export type CustomerPackageDto = CustomerPackageBrief & {
  usedSessions: number
  customerId: string
  customerCode: string
  customerName: string
  customerPhone: string
  packageTemplateId: string
  price: number
  extendedDays: number | null
  extendReason: string | null
  consultantName: string
  invoiceId: string
  invoiceCode: string
  expiringSoon: boolean
  canExtend: boolean
}

export type PackageUsageDto = {
  id: string
  usedAt: string
  appointmentId: string | null
  appointmentCode: string | null
  invoiceCode: string
  staffName: string
  overrideReason: string | null
  refunded: boolean
}

export type CustomerPackageDetailDto = CustomerPackageDto & { usages: PackageUsageDto[] }

export type CustomerPackageQuery = PaginationQuery & {
  status?: CustomerPackageStatus
  filter?: 'expiringSoon' | 'lastSession'
  customerId?: string
}

// ───────────────────────────── Hoa hồng, lịch của tôi (07 §4.8)

export type CommissionRowDto = {
  staffMemberId: string | null
  staffCode: string | null
  staffName: string | null
  serviceCount: number
  serviceBase: number
  serviceCommission: number
  packageCount: number
  packageCommission: number
  total: number
}

export type CommissionSheetDto = {
  month: string
  code: string
  status: CommissionPeriodStatus
  closedAt: string | null
  closedByName: string | null
  paidAt: string | null
  paidByName: string | null
  canClose: boolean
  closeBlockedReason: string | null
  rows: CommissionRowDto[]
  totals: CommissionRowDto
}

export type CommissionItemDto = {
  id: string
  earnedAt: string
  invoiceId: string
  invoiceCode: string
  appointmentId: string | null
  customerName: string
  kind: CommissionKind
  description: string
  baseAmount: number
  rateType: CommissionType
  rateValue: number
  amount: number
}

export type MyCommissionsDto = {
  month: string
  status: CommissionPeriodStatus
  total: number
  serviceCommission: number
  packageCommission: number
  items: CommissionItemDto[]
}

export type MyScheduleDto = {
  staffMemberId: string
  staffName: string
  date: string
  shift: ShiftType
  shiftStart: number | null
  shiftEnd: number | null
  offReason: string | null
  items: {
    appointmentId: string
    appointmentCode: string
    status: AppointmentStatus
    lineId: string
    startAt: string
    endAt: string
    serviceName: string
    customerName: string
    customerNote: string | null
    appointmentNote: string | null
  }[]
}

// ───────────────────────────── Tổng quan, báo cáo (07 §4.10)

export type DashboardCard = {
  id: string
  code: string
  status: AppointmentStatus
  source: AppointmentSource
  customerName: string
  startAt: string
  endAt: string
  services: string
  staffNames: string
  createdAt: string
  pendingOverdue: boolean
  isLate: boolean
}

export type DashboardTodayDto = {
  date: string
  shopClosedReason: string | null
  counts: {
    total: number
    pending: number
    confirmed: number
    inService: number
    completed: number
    noShow: number
    cancelled: number
  }
  revenueToday: number
  newCustomersToday: number
  upcoming: DashboardCard[]
  pendingOnline: DashboardCard[]
  tomorrow: DashboardCard[]
}

export type ReportRangeQuery = { from?: string; to?: string; groupId?: string }

export type RevenueTotals = {
  from: string
  to: string
  serviceRevenue: number
  packageRevenue: number
  revenue: number
  serviceValue: number
  invoiceCount: number
  discount: number
}

export type RevenueReportDto = {
  from: string
  to: string
  days: {
    date: string
    serviceRevenue: number
    packageRevenue: number
    revenue: number
    serviceValue: number
    invoiceCount: number
    discount: number
  }[]
  totals: RevenueTotals
  previous: RevenueTotals
}

export type ServiceReportDto = {
  rows: {
    serviceId: string
    code: string
    name: string
    groupName: string
    count: number
    value: number
    share: number
    packageCount: number
  }[]
  totalCount: number
  totalValue: number
  totalPackageCount: number
}

export type TechnicianReportDto = {
  rows: {
    staffMemberId: string
    code: string
    fullName: string
    count: number
    value: number
    bookedMinutes: number
    shiftMinutes: number
    occupancy: number
    commission: number
  }[]
}

export type PackageReportDto = {
  soldCount: number
  soldAmount: number
  activeCount: number
  unusedSessions: number
  unusedValue: number
  rows: { packageTemplateId: string; code: string; name: string; soldCount: number; soldAmount: number; usedSessions: number }[]
  expiringSoon: CustomerPackageDto[]
}

export type CancellationReportDto = {
  total: number
  cancelled: number
  noShow: number
  cancelRate: number
  noShowRate: number
  bySource: { source: AppointmentSource; total: number; cancelled: number; noShow: number }[]
}
