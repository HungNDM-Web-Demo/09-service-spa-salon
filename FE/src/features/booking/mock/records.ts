import type {
  AppointmentSource,
  AppointmentStatus,
  CancelReason,
  CommissionPeriodStatus,
  CommissionType,
  CustomerPackageStatus,
  DiscountType,
  Gender,
  InvoiceLineKind,
  InvoiceStatus,
  MessageChannel,
  MessageKind,
  PaymentMethod,
  ShiftType,
  StaffKind,
} from '@/types/spa'

/**
 * Bản ghi lưu trong mock-db, cùng cột với bảng BE (06 §4). Dòng lịch hẹn, tin nhắn nằm trong lịch hẹn; dòng hóa đơn nằm
 * trong hóa đơn. Hoa hồng và lần trừ buổi suy ra từ dòng hóa đơn (hóa đơn đã hủy = hoa hồng bị xóa, buổi đã hoàn trả)
 * để dữ liệu localStorage gọn.
 */

export type GroupRecord = { id: string; name: string; sortOrder: number; isVisible: boolean; createdAt: string }

export type ServiceRecord = {
  id: string
  code: string
  name: string
  groupId: string
  durationMinutes: number
  cleanupMinutes: number
  price: number
  description: string | null
  imageUrl: string | null
  allowOnline: boolean
  commissionType: CommissionType
  commissionValue: number
  isVisible: boolean
  createdAt: string
}

export type TemplateRecord = {
  id: string
  code: string
  name: string
  serviceId: string
  sessions: number
  price: number
  validityMonths: number
  minIntervalDays: number
  commissionRate: number
  isActive: boolean
  createdAt: string
}

export type HoursRecord = { id: string; openMinute: number; closeMinute: number }

export type StaffRecord = {
  id: string
  code: string
  fullName: string
  phone: string
  kind: StaffKind
  color: string
  specialty: string | null
  userId: string | null
  isActive: boolean
  sortOrder: number
  serviceIds: string[]
  /** 7 phần tử Thứ Hai → Chủ nhật; lễ tân rỗng */
  shifts: ShiftType[]
  createdAt: string
}

export type DayOffRecord = { id: string; staffMemberId: string | null; date: string; reason: string; createdAt: string }

export type CustomerRecord = {
  id: string
  code: string
  phone: string
  fullName: string
  birthDate: string | null
  gender: Gender | null
  note: string | null
  createdAt: string
}

export type LineRecord = {
  id: string
  serviceId: string
  serviceName: string
  price: number
  durationMinutes: number
  cleanupMinutes: number
  staffMemberId: string
  startAt: string
  endAt: string
  sortOrder: number
}

export type MessageRecord = { id: string; kind: MessageKind; channel: MessageChannel; content: string; sentAt: string }

export type AppointmentRecord = {
  id: string
  code: string
  customerId: string
  date: string
  startAt: string
  endAt: string
  source: AppointmentSource
  status: AppointmentStatus
  note: string | null
  createdByName: string | null
  confirmedAt: string | null
  confirmedByName: string | null
  checkedInAt: string | null
  checkedInByName: string | null
  cancelReason: CancelReason | null
  cancelNote: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  noShowAt: string | null
  noShowByName: string | null
  completedAt: string | null
  reminderSentAt: string | null
  createdAt: string
  lines: LineRecord[]
  messages: MessageRecord[]
}

export type InvoiceLineRecord = {
  id: string
  kind: InvoiceLineKind
  sortOrder: number
  appointmentLineId: string | null
  serviceId: string
  packageTemplateId: string | null
  customerPackageId: string | null
  description: string
  staffMemberId: string
  staffName: string
  durationMinutes: number
  listPrice: number
  usesPackage: boolean
  amount: number
  basePrice: number
  packageCode: string | null
  packageRemaining: number | null
  packageExpiryDate: string | null
  /** Hoa hồng của dòng (BR-23, BR-24); thay bảng Hr_Commissions */
  commissionRateType: CommissionType
  commissionRateValue: number
  commissionAmount: number
  /** Lý do trừ buổi sớm (BR-19) khi dòng này cần */
  overrideReason: string | null
}

export type InvoiceRecord = {
  id: string
  code: string
  appointmentId: string | null
  customerId: string
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
  clientRequestId: string | null
  createdAt: string
  lines: InvoiceLineRecord[]
}

export type PackageRecord = {
  id: string
  code: string
  customerId: string
  packageTemplateId: string
  packageName: string
  serviceId: string
  serviceName: string
  totalSessions: number
  usedSessions: number
  price: number
  sessionValue: number
  minIntervalDays: number
  commissionRate: number
  purchasedAt: string
  expiryDate: string
  extendedDays: number | null
  extendReason: string | null
  extendedAt: string | null
  extendedByName: string | null
  consultantStaffId: string
  consultantName: string
  invoiceId: string
  status: CustomerPackageStatus
  createdAt: string
}

export type PeriodRecord = {
  id: string
  code: string
  month: number
  status: CommissionPeriodStatus
  closedAt: string | null
  closedByName: string | null
  paidAt: string | null
  paidByName: string | null
}

export type MetaRecord = { id: string; anchor: number; date: string }
