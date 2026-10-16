import { formatNumber, formatVnd } from '@/lib/format'
import type { CommissionType } from '@/types/spa'
import { monthKeyOf, monthLabel, monthText, vnToday } from '@/features/booking/lib/vn-time'

/** Tháng hoa hồng dạng "yyyy-MM" theo giờ Việt Nam (BR-25: hoa hồng tính vào tháng của ngày thanh toán). */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export const isMonth = (value: string | null | undefined): value is string => !!value && MONTH_RE.test(value)

/** Tháng hiện tại, vd "2026-10" */
export const currentMonth = (): string => monthText(monthKeyOf(vnToday()))

/** Cộng/trừ tháng: shiftMonth('2026-01', -1) → "2025-12" */
export function shiftMonth(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** "2026-10" → "10/2026" */
export const monthDisplay = (month: string): string => monthLabel(Number(month.slice(0, 4)) * 100 + Number(month.slice(5, 7)))

/** Mức hoa hồng của một khoản (BR-23, BR-24): phần trăm → "12%", cố định → "30.000 ₫" */
export const rateText = (type: CommissionType, value: number): string =>
  type === 'PhanTram' ? `${formatNumber(value, 2)}%` : formatVnd(value)
