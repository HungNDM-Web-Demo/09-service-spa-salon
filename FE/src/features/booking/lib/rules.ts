import type { AppointmentStatus, CancelReason, ShiftType } from '@/types/spa'
import { hhmm } from './vn-time'

/**
 * Hằng số và phép tính thuần của nghiệp vụ Spa (06 §3, 07 §3). BE `Domain/Entities/Booking/BookingRules.cs` cùng
 * giá trị, cùng câu báo. Giờ trong ngày tính bằng phút từ 00:00 giờ Việt Nam.
 */
export const bookingRules = {
  slotStep: 15,
  onlineStep: 30,
  onlineMinLeadMinutes: 120,
  onlineMaxDaysAhead: 30,
  onlineMaxServices: 3,
  onlineMaxPendingPerPhone: 2,
  maxLines: 5,
  pendingOverdueMinutes: 30,
  lateMinutes: 15,
  selfCancelMinLeadMinutes: 120,
  reminderLeadMinutes: 120,
  noShowFlagThreshold: 3,
  noShowWindowDays: 90,
  staffDiscountLimit: 10,
  managerDiscountLimit: 50,
  maxExtendDays: 60,
  shiftSplit: 900,
  defaultOpen: 540,
  defaultClose: 1260,
  defaultPackageCommissionRate: 5,
  maxCommissionPercent: 50,
  maxReportDays: 366,
  expiringSoonDays: 30,
  durationMin: 15,
  durationMax: 240,
  cleanupMax: 30,
  cleanupDefault: 10,
  appointmentPrefix: 'LH',
  invoicePrefix: 'HD',
  packagePrefix: 'GL',
  commissionPrefix: 'HH',
  onlineCreatorName: 'Khách đặt online',
  systemActorName: 'Hệ thống',
} as const

const OCCUPYING: AppointmentStatus[] = ['ChoXacNhan', 'DaXacNhan', 'DangPhucVu', 'HoanThanh']

/** Lịch chiếm chỗ KTV, tính trùng giờ của khách (BR-03, BR-05) */
export const isOccupying = (status: AppointmentStatus): boolean => OCCUPYING.includes(status)

const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor
export const floor15 = (m: number): number => m - mod(m, 15)
export const ceil15 = (m: number): number => (mod(m, 15) === 0 ? m : floor15(m) + 15)
/** Làm tròn xuống tới bội số 1.000 ₫ (06 §3) */
export const floor1000 = (v: number): number => Math.floor(v / 1000 + 1e-9) * 1000

/** Hai khoảng [a1, b1), [a2, b2) giao nhau; chạm mép không tính (BR-03) */
export const overlaps = (a1: number, b1: number, a2: number, b2: number): boolean => a1 < b2 && a2 < b1

/** Khung giờ của ca (BR-04); Nghỉ trả null */
export function shiftWindow(shift: ShiftType, open: number, close: number): { start: number; end: number } | null {
  switch (shift) {
    case 'Sang':
      return { start: open, end: Math.min(bookingRules.shiftSplit, close) }
    case 'Chieu':
      return { start: Math.max(bookingRules.shiftSplit, open), end: close }
    case 'CaNgay':
      return { start: open, end: close }
    default:
      return null
  }
}

/** "ca sáng 09:00–15:00", "ca chiều 15:00–21:00", "cả ngày 09:00–21:00" */
export function shiftLabel(shift: ShiftType, open: number, close: number): string {
  const w = shiftWindow(shift, open, close)
  if (!w) return 'nghỉ'
  const name = shift === 'Sang' ? 'ca sáng' : shift === 'Chieu' ? 'ca chiều' : 'cả ngày'
  return `${name} ${hhmm(w.start)}–${hhmm(w.end)}`
}

/** "1.250.000 ₫" */
export const formatVndPlain = (value: number): string => `${Math.round(value).toLocaleString('vi-VN')} ₫`

/** Giá trị một buổi = giá gói ÷ số buổi, làm tròn xuống 1.000 ₫ (BR-22) */
export const sessionValueOf = (price: number, sessions: number): number => (sessions <= 0 ? 0 : floor1000(price / sessions))

export const docStem = (prefix: string, dateKey: string): string => `${prefix}${dateKey.slice(2).replace(/-/g, '')}`
export const docCode = (prefix: string, dateKey: string, sequence: number): string =>
  `${docStem(prefix, dateKey)}${String(sequence).padStart(3, '0')}`
export const commissionPeriodCode = (monthKey: number): string =>
  `${bookingRules.commissionPrefix}${String(monthKey % 10000).padStart(4, '0')}`

/** Che số điện thoại cho trang công khai: "0903 *** 456" (NFR-05) */
export const maskPhone = (phone: string): string => (phone.length < 7 ? phone : `${phone.slice(0, 4)} *** ${phone.slice(-3)}`)

export function cancelReasonLabel(reason: CancelReason): string {
  switch (reason) {
    case 'KhachBaoHuy':
      return 'Khách báo hủy'
    case 'TiemDoiLich':
      return 'Tiệm đổi lịch'
    case 'HetCho':
      return 'Hết chỗ'
    case 'KhongLienLacDuoc':
      return 'Không liên lạc được'
    case 'KhachTuHuy':
      return 'Khách tự hủy online'
    default:
      return 'Khác'
  }
}

/** Hạn mức giảm giá theo quyền (07 §3.6 bước 4) */
export const discountLimitOf = (canDiscount: boolean, canDiscountHigh: boolean): number =>
  canDiscountHigh ? bookingRules.managerDiscountLimit : canDiscount ? bookingRules.staffDiscountLimit : 0

/** Chỉ còn chữ số (người dùng gõ "0903 123 456") */
export const digitsOnly = (value: string): string => value.replace(/[\s.-]/g, '')

export const PHONE_PATTERN = /^0\d{9}$/
