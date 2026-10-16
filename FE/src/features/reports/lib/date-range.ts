import { bookingRules } from '@/features/booking/lib/rules'
import { addDaysKey, ddmmyyyy, diffDaysKey, vnToday } from '@/features/booking/lib/vn-time'

/**
 * Lựa chọn nhanh khoảng ngày của báo cáo (UC-15 bước 3): Hôm nay, 7 ngày, 30 ngày (mặc định), Tháng này, Tháng trước,
 * Tùy chọn tối đa 366 ngày (07 §3.11). Ngày tính theo giờ Việt Nam, dạng "yyyy-MM-dd".
 */
export type RangePreset = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom'
export type DateRange = { from: string; to: string }

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'lastMonth', label: 'Tháng trước' },
  { value: 'custom', label: 'Tùy chọn' },
]

export const MAX_RANGE_DAYS = bookingRules.maxReportDays
/** Báo cáo mặc định 30 ngày gần nhất (UC-15 bước 1) */
export const DEFAULT_PRESET: Exclude<RangePreset, 'custom'> = '30d'

export function presetRange(preset: Exclude<RangePreset, 'custom'>, today: string = vnToday()): DateRange {
  const firstOfMonth = `${today.slice(0, 8)}01`
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: addDaysKey(today, -6), to: today }
    case '30d':
      return { from: addDaysKey(today, -29), to: today }
    case 'thisMonth':
      return { from: firstOfMonth, to: today }
    case 'lastMonth': {
      const end = addDaysKey(firstOfMonth, -1)
      return { from: `${end.slice(0, 8)}01`, to: end }
    }
  }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Số ngày tính cả hai đầu; null khi sai định dạng */
export function rangeDays(from: string, to: string): number | null {
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to)) return null
  return diffDaysKey(from, to) + 1
}

/** Lỗi khoảng ngày, chặn trước khi gọi API; null là hợp lệ */
export function rangeError(from: string, to: string): string | null {
  const days = rangeDays(from, to)
  if (days === null) return 'Chọn đủ ngày bắt đầu và kết thúc'
  if (days < 1) return 'Ngày kết thúc phải từ ngày bắt đầu trở đi'
  if (days > MAX_RANGE_DAYS) return `Khoảng ngày tối đa ${MAX_RANGE_DAYS} ngày`
  return null
}

/** "2026-10-14" → "14/10" (trục biểu đồ) */
export const shortDateKey = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`

/** "Kỳ 17/09/2026 – 17/10/2026" cho dòng bộ lọc của file Excel */
export const periodText = (r: DateRange) => `Kỳ ${ddmmyyyy(r.from)} – ${ddmmyyyy(r.to)}`
