import type { Issue, ShiftType } from '@/types/spa'
import { ceil15, floor15, overlaps, shiftLabel, shiftWindow } from './rules'
import { ddmmyyyy, hhmm, isoWeekdayOf, weekdayLabel } from './vn-time'

/**
 * Kiểm tra trùng lịch, ca, giờ mở cửa (07 §3.2), mốc trống đặt online, chọn KTV "Bất kỳ ai" (07 §3.3), gợi ý (07 §3.4).
 * Thuần, không đọc dữ liệu; bản C# `Domain/Entities/Booking/ScheduleEngine.cs` làm giống hệt.
 */

export type ScheduleStaff = {
  id: string
  code: string
  fullName: string
  isActive: boolean
  isTechnician: boolean
  shift: ShiftType
  dayOffReason: string | null
  serviceIds: Set<string>
  sortOrder: number
}

export type ScheduleService = { id: string; name: string; duration: number; cleanup: number; price: number }

export type BusyLine = {
  lineId: string
  appointmentId: string
  staffId: string
  start: number
  end: number
  cleanup: number
}

export type CustomerSpan = { appointmentId: string; customerId: string; code: string; start: number; end: number }

export type DaySchedule = {
  date: string
  today: string
  /** Phút hiện tại trong ngày `today` */
  nowMinute: number
  open: number
  close: number
  closedReason: string | null
  staff: ScheduleStaff[]
  busy: BusyLine[]
  customerSpans: CustomerSpan[]
}

export type DraftLine = { lineId: string | null; service: ScheduleService; staffId: string; start: number; unchanged?: boolean }

export type LineCheck = { index: number; start: number; end: number; blockEnd: number; issues: Issue[] }

export type DraftCheck = { lines: LineCheck[]; issues: Issue[]; ok: boolean; first: Issue | null }

export type Assignment = { staffId: string; service: ScheduleService; start: number }

export const scheduleCodes = {
  gioQuaKhu: 'GioQuaKhu',
  buocGio: 'BuocGio',
  tiemNghi: 'TiemNghi',
  ngoaiGioMoCua: 'NgoaiGioMoCua',
  chuaChonKtv: 'ChuaChonKtv',
  nghiViec: 'NghiViec',
  khongLamDuoc: 'KhongLamDuoc',
  ktvNghi: 'KtvNghi',
  ngoaiCa: 'NgoaiCa',
  trungLichKtv: 'TrungLichKtv',
  trungLichKhach: 'TrungLichKhach',
  soDong: 'SoDong',
} as const

const blockEndOf = (b: BusyLine) => b.end + b.cleanup
const findStaff = (day: DaySchedule, id: string) => day.staff.find((s) => s.id === id)

/** Kiểm tra một dòng với các dòng chiếm chỗ `busy` (07 §3.2, trả mọi lỗi theo thứ tự) */
export function checkLine(day: DaySchedule, line: DraftLine, index: number, busy: BusyLine[]): LineCheck {
  const issues: Issue[] = []
  const service = line.service
  const start = line.start
  const end = start + service.duration
  const blockEnd = end + service.cleanup

  if (!line.unchanged) {
    if (day.date < day.today || (day.date === day.today && start < floor15(day.nowMinute)))
      issues.push({ code: scheduleCodes.gioQuaKhu, message: 'Giờ bắt đầu đã qua' })
    if (start % 15 !== 0) issues.push({ code: scheduleCodes.buocGio, message: 'Giờ bắt đầu theo bước 15 phút' })
  }

  if (day.closedReason !== null)
    issues.push({ code: scheduleCodes.tiemNghi, message: `Tiệm nghỉ ngày ${ddmmyyyy(day.date)} (${day.closedReason})` })
  if (start < day.open) issues.push({ code: scheduleCodes.ngoaiGioMoCua, message: `Trước giờ mở cửa (${hhmm(day.open)})` })
  const endPastClose = end > day.close
  if (endPastClose)
    issues.push({ code: scheduleCodes.ngoaiGioMoCua, message: `Kết thúc ${hhmm(end)}, quá giờ đóng cửa (${hhmm(day.close)})` })

  const staff = findStaff(day, line.staffId)
  if (!staff) {
    issues.push({ code: scheduleCodes.chuaChonKtv, message: 'Chọn kỹ thuật viên' })
    return { index, start, end, blockEnd, issues }
  }

  if (!staff.isActive) issues.push({ code: scheduleCodes.nghiViec, message: `${staff.fullName} đã nghỉ việc` })
  if (!staff.serviceIds.has(service.id))
    issues.push({ code: scheduleCodes.khongLamDuoc, message: `${staff.fullName} không làm được ${service.name}` })

  const window = staff.dayOffReason === null ? shiftWindow(staff.shift, day.open, day.close) : null
  if (staff.dayOffReason !== null) {
    issues.push({ code: scheduleCodes.ktvNghi, message: `${staff.fullName} nghỉ ngày ${ddmmyyyy(day.date)} (${staff.dayOffReason})` })
  } else if (!window) {
    issues.push({ code: scheduleCodes.ktvNghi, message: `${staff.fullName} nghỉ ${weekdayLabel(isoWeekdayOf(day.date))}` })
  } else if ((start < window.start && start >= day.open) || (end > window.end && !endPastClose)) {
    issues.push({ code: scheduleCodes.ngoaiCa, message: `Ngoài ca làm (${shiftLabel(staff.shift, day.open, day.close)})` })
  }

  const conflict = busy
    .filter((b) => b.staffId === staff.id && overlaps(start, blockEnd, b.start, blockEndOf(b)))
    .sort((a, b) => a.start - b.start)[0]
  if (conflict) {
    const message =
      start >= conflict.start
        ? `${staff.fullName} bận tới ${hhmm(blockEndOf(conflict))}${conflict.cleanup > 0 ? ' (gồm thời gian dọn)' : ''}`
        : `${staff.fullName} có lịch lúc ${hhmm(conflict.start)}${
            service.cleanup > 0 && end <= conflict.start ? `, cần thêm ${service.cleanup} phút dọn sau dịch vụ` : ''
          }`
    issues.push({ code: scheduleCodes.trungLichKtv, message })
  }

  return { index, start, end, blockEnd, issues }
}

/** Kiểm tra cả bản nháp (07 §3.2): từng dòng, số dòng, trùng lịch của khách (BR-05) */
export function checkDraft(
  day: DaySchedule,
  lines: DraftLine[],
  appointmentId: string | null,
  customerId: string | null
): DraftCheck {
  const self = appointmentId ?? ''
  const saved = day.busy.filter((b) => !appointmentId || b.appointmentId !== appointmentId)
  const checks = lines.map((line, i) => {
    const others = lines
      .filter((_, j) => j !== i)
      .map<BusyLine>((l) => ({
        lineId: l.lineId ?? '',
        appointmentId: self,
        staffId: l.staffId,
        start: l.start,
        end: l.start + l.service.duration,
        cleanup: l.service.cleanup,
      }))
    return checkLine(day, line, i, [...saved, ...others])
  })

  const issues: Issue[] = []
  if (lines.length === 0) issues.push({ code: scheduleCodes.soDong, message: 'Thêm ít nhất một dịch vụ' })
  else if (lines.length > 5) issues.push({ code: scheduleCodes.soDong, message: 'Lịch hẹn tối đa 5 dịch vụ' })

  if (customerId && lines.length > 0) {
    const spanStart = Math.min(...lines.map((l) => l.start))
    const spanEnd = Math.max(...lines.map((l) => l.start + l.service.duration))
    const other = day.customerSpans
      .filter((c) => c.customerId === customerId && c.appointmentId !== self && overlaps(spanStart, spanEnd, c.start, c.end))
      .sort((a, b) => a.start - b.start)[0]
    if (other)
      issues.push({
        code: scheduleCodes.trungLichKhach,
        message: `Khách đã có lịch ${other.code} ${hhmm(other.start)}–${hhmm(other.end)}`,
      })
  }

  const ok = issues.length === 0 && checks.every((c) => c.issues.length === 0)
  const first = checks.flatMap((c) => c.issues).concat(issues)[0] ?? null
  return { lines: checks, issues, ok, first }
}

/** Tổng phút dịch vụ đã xếp cho KTV trong ngày (không tính thời gian dọn, BR-07) */
export const bookedMinutes = (day: DaySchedule, staffId: string): number =>
  day.busy.filter((b) => b.staffId === staffId).reduce((sum, b) => sum + b.end - b.start, 0)

const compareCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function isFree(day: DaySchedule, line: DraftLine, assigned: Assignment[]): boolean {
  const busy = day.busy.concat(
    assigned.map((a) => ({
      lineId: '',
      appointmentId: '',
      staffId: a.staffId,
      start: a.start,
      end: a.start + a.service.duration,
      cleanup: a.service.cleanup,
    }))
  )
  return checkLine(day, line, 0, busy).issues.length === 0
}

function tryWholeStaff(day: DaySchedule, services: ScheduleService[], staff: ScheduleStaff, start: number): Assignment[] | null {
  if (!services.every((s) => staff.serviceIds.has(s.id))) return null
  const assigned: Assignment[] = []
  let at = start
  for (const service of services) {
    if (!isFree(day, { lineId: null, service, staffId: staff.id, start: at }, assigned)) return null
    assigned.push({ staffId: staff.id, service, start: at })
    at = ceil15(at + service.duration + service.cleanup)
  }
  return assigned
}

/** Giao các dịch vụ nối tiếp bắt đầu lúc `start` (07 §3.3). staffId null là "Bất kỳ ai". Null khi mốc không hợp lệ */
export function assignOnline(
  day: DaySchedule,
  services: ScheduleService[],
  staffId: string | null,
  start: number
): Assignment[] | null {
  if (services.length === 0 || day.closedReason !== null) return null
  if (staffId) {
    const staff = findStaff(day, staffId)
    return !staff || !staff.isTechnician ? null : tryWholeStaff(day, services, staff, start)
  }

  const candidates = day.staff
    .filter((s) => s.isActive && s.isTechnician && services.every((x) => s.serviceIds.has(x.id)))
    .sort((a, b) => bookedMinutes(day, a.id) - bookedMinutes(day, b.id) || compareCode(a.code, b.code))
  for (const candidate of candidates) {
    const whole = tryWholeStaff(day, services, candidate, start)
    if (whole) return whole
  }

  // Không ai giao trọn được: gán từng dòng theo cùng quy tắc
  const assigned: Assignment[] = []
  const extra = new Map<string, number>()
  let previous: Assignment | null = null
  for (const service of services) {
    let best: Assignment | null = null
    let bestMinutes = Number.MAX_SAFE_INTEGER
    let bestCode: string | null = null
    for (const staff of day.staff.filter((s) => s.isActive && s.isTechnician && s.serviceIds.has(service.id))) {
      const at: number = !previous
        ? start
        : previous.staffId === staff.id
          ? ceil15(previous.start + previous.service.duration + previous.service.cleanup)
          : previous.start + previous.service.duration
      if (!isFree(day, { lineId: null, service, staffId: staff.id, start: at }, assigned)) continue
      const minutes = bookedMinutes(day, staff.id) + (extra.get(staff.id) ?? 0)
      if (minutes < bestMinutes || (minutes === bestMinutes && (bestCode === null || compareCode(staff.code, bestCode) < 0))) {
        best = { staffId: staff.id, service, start: at }
        bestMinutes = minutes
        bestCode = staff.code
      }
    }
    if (!best) return null
    assigned.push(best)
    extra.set(best.staffId, (extra.get(best.staffId) ?? 0) + service.duration)
    previous = best
  }
  return assigned
}

/** Mốc giờ trống đặt online (FR-19), bước 30 phút, không sớm hơn `minStart` */
export function onlineSlots(day: DaySchedule, services: ScheduleService[], staffId: string | null, minStart: number): number[] {
  const slots: number[] = []
  if (day.closedReason !== null || services.length === 0) return slots
  const total = services.reduce((s, x) => s + x.duration, 0)
  for (let t = day.open; t + total <= day.close; t += 30) {
    if (t >= minStart && assignOnline(day, services, staffId, t)) slots.push(t)
  }
  return slots
}

/** KTV khác rảnh và 3 giờ trống gần nhất của KTV đang chọn (FR-11, 07 §3.4) */
export function suggest(
  day: DaySchedule,
  service: ScheduleService,
  currentStaffId: string,
  start: number,
  otherDraftLines: DraftLine[],
  appointmentId: string | null
): { freeStaff: ScheduleStaff[]; nextSlots: number[] } {
  const self = appointmentId ?? ''
  const busy = day.busy
    .filter((b) => !appointmentId || b.appointmentId !== self)
    .concat(
      otherDraftLines.map((l) => ({
        lineId: l.lineId ?? '',
        appointmentId: self,
        staffId: l.staffId,
        start: l.start,
        end: l.start + l.service.duration,
        cleanup: l.service.cleanup,
      }))
    )
  const ok = (staffId: string, at: number) =>
    checkLine(day, { lineId: null, service, staffId, start: at }, 0, busy).issues.length === 0

  const freeStaff = day.staff
    .filter((s) => s.id !== currentStaffId && s.isActive && s.isTechnician && s.serviceIds.has(service.id) && ok(s.id, start))
    .sort((a, b) => compareCode(a.code, b.code))

  const slots: number[] = []
  if (day.date >= day.today) {
    let from = day.date === day.today ? Math.max(day.open, floor15(day.nowMinute)) : day.open
    from = ceil15(from)
    for (let t = from; t + service.duration <= day.close; t += 15) if (ok(currentStaffId, t)) slots.push(t)
  }
  const nextSlots = [...slots]
    .sort((a, b) => Math.abs(a - start) - Math.abs(b - start) || a - b)
    .slice(0, 3)
    .sort((a, b) => a - b)
  return { freeStaff, nextSlots }
}

/** Giờ mặc định của dòng kế tiếp (UC-03 bước 5): giờ kết thúc dòng trước; cùng KTV thì cộng thời gian dọn, làm tròn 15 phút */
export function nextLineStart(prev: { start: number; duration: number; cleanup: number; staffId: string }, staffId: string): number {
  const end = prev.start + prev.duration
  return prev.staffId === staffId ? ceil15(end + prev.cleanup) : end
}
