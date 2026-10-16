/**
 * Giờ Việt Nam (UTC+7, không đổi giờ mùa hè) cho ngày lịch hẹn, khung giờ, mã chứng từ, báo cáo
 * (06 §3; BE `VietnamDates`). Không phụ thuộc múi giờ của máy. Chép từ demo Quản lý Kho, thêm phút trong ngày.
 */

const OFFSET_MS = 7 * 60 * 60_000
export const DAY_MS = 86_400_000

type DateInput = Date | number | string

export type VnParts = { year: number; month: number; day: number; hour: number; minute: number; isoWeekday: number }

/** Thời điểm hiện tại (ms). Một chỗ để mock và giao diện dùng chung. */
export const vnNow = (): number => Date.now()

export function vnParts(date: DateInput): VnParts {
  const d = new Date(new Date(date).getTime() + OFFSET_MS)
  const weekday = d.getUTCDay()
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    isoWeekday: weekday === 0 ? 7 : weekday,
  }
}

/** Khóa ngày "yyyy-MM-dd" theo giờ Việt Nam */
export function vnDateKey(date: DateInput): string {
  const p = vnParts(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export const vnToday = (): string => vnDateKey(vnNow())

/** "yyMMdd" của khóa ngày (mã LH, HD, GL) */
export const yyMMdd = (dateKey: string): string => dateKey.slice(2).replace(/-/g, '')

/** Thời điểm UTC (ms) của 00:00 ngày "yyyy-MM-dd" giờ Việt Nam */
export function vnStartOfDay(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d) - OFFSET_MS
}

/** ISO UTC của phút `minute` trong ngày `dateKey` giờ Việt Nam */
export function vnIso(dateKey: string, minute: number): string {
  return new Date(vnStartOfDay(dateKey) + minute * 60_000).toISOString()
}

/** Phút trong ngày (giờ Việt Nam) của một thời điểm */
export function vnMinutesOfDay(date: DateInput): number {
  const p = vnParts(date)
  return p.hour * 60 + p.minute
}

/** Ngày và phút trong ngày của thời điểm `date` */
export function vnLocal(date: DateInput): { date: string; minute: number } {
  const key = vnDateKey(date)
  return { date: key, minute: Math.round((new Date(date).getTime() - vnStartOfDay(key)) / 60_000) }
}

export function addDaysKey(dateKey: string, days: number): string {
  return vnDateKey(vnStartOfDay(dateKey) + days * DAY_MS + 12 * 3600_000)
}

export function diffDaysKey(from: string, to: string): number {
  return Math.round((vnStartOfDay(to) - vnStartOfDay(from)) / DAY_MS)
}

/** 1 = Thứ Hai … 7 = Chủ nhật */
export function isoWeekdayOf(dateKey: string): number {
  return vnParts(vnStartOfDay(dateKey) + 12 * 3600_000).isoWeekday
}

/** Cộng tháng, tháng đích thiếu ngày thì lấy ngày cuối tháng (BR-20, giống DateOnly.AddMonths của .NET) */
export function addMonthsKey(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ty = Math.floor(total / 12)
  const tm = total % 12
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** "HH:mm" của số phút */
export function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function parseHhmm(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/** "HH:mm" giờ Việt Nam của một thời điểm */
export const vnHhmm = (date: DateInput): string => hhmm(vnMinutesOfDay(date))

/** "dd/MM/yyyy" của khóa ngày */
export function ddmmyyyy(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${d}/${m}/${y}`
}

/** "dd/MM/yyyy" giờ Việt Nam của một thời điểm */
export const vnDdMmYyyy = (date: DateInput): string => ddmmyyyy(vnDateKey(date))

/** "HH:mm dd/MM/yyyy" giờ Việt Nam */
export const vnHhmmDate = (date: DateInput): string => `${vnHhmm(date)} ${vnDdMmYyyy(date)}`

/** Tháng "yyyy-MM" ↔ khóa số yyyyMM */
export const monthKeyOf = (dateKey: string): number => Number(dateKey.slice(0, 4)) * 100 + Number(dateKey.slice(5, 7))
export const monthText = (key: number): string => `${Math.floor(key / 100)}-${String(key % 100).padStart(2, '0')}`
export const monthLabel = (key: number): string => `${String(key % 100).padStart(2, '0')}/${Math.floor(key / 100)}`

/** Thời điểm `iso` có nằm trong khoảng ngày [from, to] (giờ Việt Nam) */
export function inVnRange(iso: string | null | undefined, from?: string | null, to?: string | null): boolean {
  if (!from && !to) return true
  if (!iso) return false
  const key = vnDateKey(iso)
  if (from && key < from) return false
  if (to && key > to) return false
  return true
}

const WEEKDAYS = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
export const weekdayLabel = (iso: number): string => WEEKDAYS[iso] ?? ''
export const weekdayShort = (iso: number): string => ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][iso] ?? ''
