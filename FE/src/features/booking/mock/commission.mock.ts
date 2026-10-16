import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import { newId } from '@/mock/mock-helpers'
import type { CommissionItemDto, CommissionRowDto, CommissionSheetDto, MyCommissionsDto, MyScheduleDto } from '@/types/spa'
import { commissionPeriodCode, isOccupying, shiftWindow } from '../lib/rules'
import { ddmmyyyy, isoWeekdayOf, monthKeyOf, monthLabel, monthText, weekdayLabel } from '../lib/vn-time'
import { conflictError, errorCodes, invalidState, notFoundError } from './errors'
import { commissionItems } from './mappers'
import type { PeriodRecord } from './records'
import { actor, appointmentsDb, customersDb, daysOffDb, ensureFresh, hours, nowIso, periodsDb, staffDb, today } from './store'

/** Handler mock bảng hoa hồng tháng, hoa hồng và lịch của tôi (07 §3.8, §4.8). */

const parseMonth = (month?: string | null): number =>
  month && /^\d{4}-\d{2}$/.test(month) ? Number(month.slice(0, 4)) * 100 + Number(month.slice(5, 7)) : monthKeyOf(today())

const nextMonthStart = (key: number) => {
  const y = Math.floor(key / 100)
  const m = key % 100
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

function strip(c: CommissionItemDto & { staffMemberId: string; month: number }): CommissionItemDto {
  const { staffMemberId, month, ...item } = c
  void staffMemberId
  void month
  return item
}

function row(items: (CommissionItemDto & { staffMemberId: string })[], staffId: string | null): CommissionRowDto {
  const member = staffId ? staffDb.get(staffId) : undefined
  const service = items.filter((c) => c.kind === 'DichVu')
  const pkg = items.filter((c) => c.kind === 'BanGoi')
  return {
    staffMemberId: member?.id ?? null,
    staffCode: member?.code ?? null,
    staffName: member?.fullName ?? null,
    serviceCount: service.length,
    serviceBase: service.reduce((s, c) => s + c.baseAmount, 0),
    serviceCommission: service.reduce((s, c) => s + c.amount, 0),
    packageCount: pkg.length,
    packageCommission: pkg.reduce((s, c) => s + c.amount, 0),
    total: items.reduce((s, c) => s + c.amount, 0),
  }
}

function sheet(month: number): CommissionSheetDto {
  const period = periodsDb.find((p) => p.month === month)
  const items = commissionItems(() => true).filter((c) => c.month === month)
  const staffIds = [...new Set(items.map((c) => c.staffMemberId))]
  const rows = staffIds
    .map((id) => row(items.filter((c) => c.staffMemberId === id), id))
    .sort((a, b) => b.total - a.total || ((a.staffCode ?? '') < (b.staffCode ?? '') ? -1 : 1))
  const status = period?.status ?? 'TamTinh'
  const start = nextMonthStart(month)
  const blocked = status !== 'TamTinh' ? null : today() < start ? `Chỉ chốt từ ${ddmmyyyy(start)}` : null
  return {
    month: monthText(month),
    code: period?.code ?? commissionPeriodCode(month),
    status,
    closedAt: period?.closedAt ?? null,
    closedByName: period?.closedByName ?? null,
    paidAt: period?.paidAt ?? null,
    paidByName: period?.paidByName ?? null,
    canClose: status === 'TamTinh' && blocked === null,
    closeBlockedReason: blocked,
    rows,
    totals: row(items, null),
  }
}

function getOrCreate(month: number): PeriodRecord {
  return (
    periodsDb.find((p) => p.month === month) ??
    periodsDb.insert({
      id: newId(),
      code: commissionPeriodCode(month),
      month,
      status: 'TamTinh',
      closedAt: null,
      closedByName: null,
      paidAt: null,
      paidByName: null,
    })
  )
}

function currentStaff(message: string) {
  const me = actor()
  const member = staffDb.find((s) => s.userId === me.userId)
  if (!member) throw notFoundError(message)
  return member
}

export const commissionMock = {
  async getSheet(month?: string): Promise<CommissionSheetDto> {
    await mockDelay()
    requirePermission(permissions.commissions.view)
    ensureFresh()
    return sheet(parseMonth(month))
  },

  async getItems(month: string | undefined, staffMemberId: string): Promise<CommissionItemDto[]> {
    await mockDelay()
    requirePermission(permissions.commissions.view)
    ensureFresh()
    const key = parseMonth(month)
    return commissionItems(() => true)
      .filter((c) => c.month === key && c.staffMemberId === staffMemberId)
      .sort((a, b) => (a.earnedAt < b.earnedAt ? -1 : a.earnedAt > b.earnedAt ? 1 : a.kind < b.kind ? -1 : 1))
      .map(strip)
  },

  async close(month: string): Promise<CommissionSheetDto> {
    await mockDelay()
    requirePermission(permissions.commissions.close)
    ensureFresh()
    const key = parseMonth(month)
    const start = nextMonthStart(key)
    if (today() < start) throw conflictError(errorCodes.chuaHetThang, `Chỉ chốt từ ${ddmmyyyy(start)}`)
    const period = getOrCreate(key)
    if (period.status !== 'TamTinh') throw invalidState(`Bảng hoa hồng tháng ${monthLabel(key)} đã chốt.`)
    periodsDb.update(period.id, { status: 'DaChot', closedAt: nowIso(), closedByName: actor().fullName })
    return sheet(key)
  },

  async pay(month: string): Promise<CommissionSheetDto> {
    await mockDelay()
    requirePermission(permissions.commissions.close)
    ensureFresh()
    const key = parseMonth(month)
    const period = getOrCreate(key)
    if (period.status !== 'DaChot') throw invalidState('Chỉ đánh dấu đã chi trả khi bảng hoa hồng đã chốt.')
    periodsDb.update(period.id, { status: 'DaChiTra', paidAt: nowIso(), paidByName: actor().fullName })
    return sheet(key)
  },

  async getMine(month?: string): Promise<MyCommissionsDto> {
    await mockDelay()
    requirePermission(permissions.commissions.viewOwn)
    ensureFresh()
    const key = parseMonth(month)
    const member = currentStaff('Tài khoản chưa liên kết với nhân viên nào.')
    const items = commissionItems(() => true)
      .filter((c) => c.month === key && c.staffMemberId === member.id)
      .sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1))
    return {
      month: monthText(key),
      status: periodsDb.find((p) => p.month === key)?.status ?? 'TamTinh',
      total: items.reduce((s, c) => s + c.amount, 0),
      serviceCommission: items.filter((c) => c.kind === 'DichVu').reduce((s, c) => s + c.amount, 0),
      packageCommission: items.filter((c) => c.kind === 'BanGoi').reduce((s, c) => s + c.amount, 0),
      items: items.map(strip),
    }
  },

  async getMySchedule(date?: string): Promise<MyScheduleDto> {
    await mockDelay()
    requirePermission(permissions.appointments.viewOwn)
    ensureFresh()
    const day = date || today()
    const member = currentStaff('Tài khoản chưa liên kết với kỹ thuật viên nào.')
    const { open, close } = hours()
    const shift = member.shifts[isoWeekdayOf(day) - 1] ?? 'Nghi'
    const window = shiftWindow(shift, open, close)
    const off = daysOffDb.find((d) => d.date === day && (d.staffMemberId === member.id || d.staffMemberId === null))
    const items = appointmentsDb
      .filter((a) => a.date === day && isOccupying(a.status))
      .flatMap((a) =>
        a.lines
          .filter((l) => l.staffMemberId === member.id)
          .map((l) => {
            const customer = customersDb.get(a.customerId)
            return {
              appointmentId: a.id,
              appointmentCode: a.code,
              status: a.status,
              lineId: l.id,
              startAt: l.startAt,
              endAt: l.endAt,
              serviceName: l.serviceName,
              customerName: customer?.fullName ?? '',
              customerNote: customer?.note ?? null,
              appointmentNote: a.note,
            }
          })
      )
      .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
    return {
      staffMemberId: member.id,
      staffName: member.fullName,
      date: day,
      shift,
      shiftStart: window?.start ?? null,
      shiftEnd: window?.end ?? null,
      offReason: off?.reason ?? (window ? null : `Nghỉ ${weekdayLabel(isoWeekdayOf(day))}`),
      items,
    }
  },
}
