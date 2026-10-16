import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { listQuery, newId } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  AppointmentDetailDto,
  AppointmentListItem,
  AppointmentQuery,
  BoardDto,
  CancelAppointmentInput,
  CheckAppointmentInput,
  CheckoutPreviewDto,
  CheckResultDto,
  CreateAppointmentInput,
  DraftLineInput,
  MessageKind,
  MoveLineInput,
  SuggestionQuery,
  SuggestionsDto,
  UpdateAppointmentInput,
} from '@/types/spa'
import { buildMessage } from '../lib/messages'
import { bookingRules, cancelReasonLabel, digitsOnly, discountLimitOf, isOccupying, shiftWindow } from '../lib/rules'
import { checkDraft, suggest, type DraftCheck, type DraftLine, type ScheduleService } from '../lib/schedule'
import { validateCancel, validateCreateAppointment } from '../lib/validation'
import { isoWeekdayOf, vnDateKey, vnIso, vnLocal, weekdayLabel } from '../lib/vn-time'
import { nextCustomerCode } from './customer.mock'
import { domainError, errorCodes, fieldErrors, invalidState, notFoundError, scheduleError } from './errors'
import { cardDto, detailDto } from './mappers'
import type { AppointmentRecord, CustomerRecord, LineRecord } from './records'
import {
  actor,
  appointmentsDb,
  can,
  customerPackages,
  customersDb,
  ensureFresh,
  groupsDb,
  loadDay,
  nextDocCode,
  noShowCount90,
  nowIso,
  servicesDb,
  staffDb,
  staffName,
  store,
  today,
} from './store'

/** Handler mock lịch hẹn (07 §3.2, §4.4), giống AppointmentService của BE. */

const EDITABLE = ['ChoXacNhan', 'DaXacNhan']

export function statusLabel(status: AppointmentRecord['status']): string {
  switch (status) {
    case 'ChoXacNhan':
      return 'Chờ xác nhận'
    case 'DaXacNhan':
      return 'Đã xác nhận'
    case 'DangPhucVu':
      return 'Đang phục vụ'
    case 'HoanThanh':
      return 'Đã hoàn thành'
    case 'DaHuy':
      return 'Đã hủy'
    default:
      return 'Không đến'
  }
}

/** Dựng bản nháp cho ScheduleEngine; dòng khác ngày nhau trả null (giống BuildDraftAsync) */
function buildDraft(lines: DraftLineInput[], existing?: AppointmentRecord): { draft: DraftLine[]; date: string } | null {
  const locals = lines.map((l) => vnLocal(l.startAt))
  const date = locals[0]?.date ?? today()
  if (locals.some((l) => l.date !== date)) return null
  const draft = lines.map((r, i) => {
    const old = r.lineId ? existing?.lines.find((l) => l.id === r.lineId) : undefined
    let service: ScheduleService
    if (old && old.serviceId === r.serviceId) {
      service = { id: old.serviceId, name: old.serviceName, duration: old.durationMinutes, cleanup: old.cleanupMinutes, price: old.price }
    } else {
      const current = servicesDb.get(r.serviceId)
      if (!current) throw fieldErrors({ [`lines[${i}].serviceId`]: 'Dịch vụ không tồn tại' })
      if (!current.isVisible || groupsDb.get(current.groupId)?.isVisible === false)
        throw fieldErrors({ [`lines[${i}].serviceId`]: `Dịch vụ ${current.name} đang ẩn` })
      service = { id: current.id, name: current.name, duration: current.durationMinutes, cleanup: current.cleanupMinutes, price: current.price }
    }
    const unchanged = !!old && old.serviceId === r.serviceId && old.staffMemberId === r.staffMemberId && old.startAt === r.startAt
    return { lineId: r.lineId ?? null, service, staffId: r.staffMemberId, start: locals[i].minute, unchanged }
  })
  return { draft, date }
}

const sameDayError = () => domainError(errorCodes.lichKhongHopLe, 'Các dòng dịch vụ phải cùng một ngày')

function toCheckResult(check: DraftCheck, date: string): CheckResultDto {
  return {
    ok: check.ok,
    issues: check.issues,
    lines: check.lines.map((l) => ({
      index: l.index,
      startAt: vnIso(date, l.start),
      endAt: vnIso(date, l.end),
      blockEndAt: vnIso(date, l.blockEnd),
      issues: l.issues,
    })),
  }
}

function newLine(d: DraftLine, date: string, order: number): LineRecord {
  const startAt = vnIso(date, d.start)
  return {
    id: newId(),
    serviceId: d.service.id,
    serviceName: d.service.name,
    price: d.service.price,
    durationMinutes: d.service.duration,
    cleanupMinutes: d.service.cleanup,
    staffMemberId: d.staffId,
    startAt,
    endAt: new Date(new Date(startAt).getTime() + d.service.duration * 60_000).toISOString(),
    sortOrder: order,
  }
}

/** Cập nhật giờ bắt đầu sớm nhất, kết thúc muộn nhất, ngày, thứ tự dòng (giống Appointment.RefreshSpan) */
export function refreshSpan(a: AppointmentRecord): AppointmentRecord {
  if (!a.lines.length) return a
  const sorted = [...a.lines].sort((x, y) => (x.startAt < y.startAt ? -1 : x.startAt > y.startAt ? 1 : x.sortOrder - y.sortOrder))
  const lines = sorted.map((l, i) => ({ ...l, sortOrder: i + 1 }))
  const startAt = lines.reduce((m, l) => (l.startAt < m ? l.startAt : m), lines[0].startAt)
  const endAt = lines.reduce((m, l) => (l.endAt > m ? l.endAt : m), lines[0].endAt)
  return { ...a, lines, startAt, endAt, date: vnDateKey(startAt) }
}

/** Áp bản nháp vào lịch; trả cờ có đổi giờ, đổi KTV, thêm, bỏ dòng (giống ApplyDraft) */
function applyDraftLines(a: AppointmentRecord, draft: DraftLine[], date: string): { record: AppointmentRecord; changed: boolean } {
  let changed = false
  const keep = new Set(draft.filter((d) => d.lineId).map((d) => d.lineId!))
  let lines = a.lines.filter((l) => {
    if (keep.has(l.id)) return true
    changed = true
    return false
  })
  let order = lines.reduce((m, l) => Math.max(m, l.sortOrder), 0)
  for (const d of draft) {
    const existing = d.lineId ? lines.find((l) => l.id === d.lineId) : undefined
    if (!existing) {
      lines = [...lines, newLine(d, date, ++order)]
      changed = true
      continue
    }
    const startAt = vnIso(date, d.start)
    let next = { ...existing }
    if (existing.serviceId !== d.service.id) {
      next = {
        ...next,
        serviceId: d.service.id,
        serviceName: d.service.name,
        price: d.service.price,
        durationMinutes: d.service.duration,
        cleanupMinutes: d.service.cleanup,
      }
      changed = true
    }
    if (existing.staffMemberId !== d.staffId || existing.startAt !== startAt) changed = true
    next.staffMemberId = d.staffId
    next.startAt = startAt
    next.endAt = new Date(new Date(startAt).getTime() + next.durationMinutes * 60_000).toISOString()
    lines = lines.map((l) => (l.id === existing.id ? next : l))
  }
  return { record: refreshSpan({ ...a, lines }), changed }
}

export function addMessage(a: AppointmentRecord, customer: CustomerRecord, kind: MessageKind, reason?: string | null): AppointmentRecord {
  const start = a.lines.length ? a.lines.reduce((m, l) => (l.startAt < m ? l.startAt : m), a.lines[0].startAt) : a.startAt
  const local = vnLocal(start)
  const names = [...a.lines]
    .sort((x, y) => (x.startAt < y.startAt ? -1 : x.startAt > y.startAt ? 1 : x.sortOrder - y.sortOrder))
    .map((l) => l.serviceName)
    .join(', ')
  return {
    ...a,
    messages: [
      ...a.messages,
      {
        id: newId(),
        kind,
        channel: 'Zalo',
        content: buildMessage(kind, store().name, a.code, local.date, local.minute, names, customer.fullName, customer.gender, reason),
        sentAt: nowIso(),
      },
    ],
  }
}

const isLate = (a: AppointmentRecord) =>
  a.date === today() && EDITABLE.includes(a.status) && Date.now() >= new Date(a.startAt).getTime() + bookingRules.lateMinutes * 60_000

function load(id: string): AppointmentRecord {
  const a = appointmentsDb.get(id)
  if (!a) throw notFoundError('Không tìm thấy lịch hẹn.')
  return a
}

async function begin(...codes: string[]) {
  await mockDelay()
  const ctx = requirePermission(...codes)
  ensureFresh()
  return ctx
}

function mutate(id: string, fn: (a: AppointmentRecord, customer: CustomerRecord, by: string) => AppointmentRecord): AppointmentDetailDto {
  const a = load(id)
  const customer = customersDb.get(a.customerId)!
  const next = fn(a, customer, actor().fullName)
  appointmentsDb.update(id, next)
  return detailDto(appointmentsDb.get(id)!, actor())
}

function cancelCore(a: AppointmentRecord, customer: CustomerRecord, by: string, input: CancelAppointmentInput): AppointmentRecord {
  const note = input.note?.trim() || null
  const record: AppointmentRecord = {
    ...a,
    status: 'DaHuy',
    cancelReason: input.reason,
    cancelNote: note,
    cancelledAt: nowIso(),
    cancelledByName: by,
  }
  const reason = input.reason === 'Khac' && note ? note : cancelReasonLabel(input.reason)
  return addMessage(record, customer, 'Huy', reason)
}

export const appointmentMock = {
  async getBoard(date?: string): Promise<BoardDto> {
    await begin(permissions.appointments.view)
    const day = date || today()
    const schedule = loadDay(day)
    const list = appointmentsDb.filter((a) => a.date === day && isOccupying(a.status))
    const withLines = new Set(list.flatMap((a) => a.lines.map((l) => l.staffMemberId)))
    const flags = new Map(list.map((a) => [a.customerId, noShowCount90(a.customerId) >= bookingRules.noShowFlagThreshold]))
    return {
      date: day,
      openMinute: schedule.open,
      closeMinute: schedule.close,
      shopClosedReason: schedule.closedReason,
      technicians: schedule.staff
        .filter(
          (s) => (s.isActive && s.dayOffReason === null && s.shift !== 'Nghi' && schedule.closedReason === null) || withLines.has(s.id)
        )
        .map((s) => {
          const window = s.dayOffReason === null ? shiftWindow(s.shift, schedule.open, schedule.close) : null
          return {
            id: s.id,
            code: s.code,
            fullName: s.fullName,
            color: staffDb.get(s.id)?.color ?? '#64748B',
            shift: window ? s.shift : null,
            shiftStart: window?.start ?? null,
            shiftEnd: window?.end ?? null,
            offReason: s.dayOffReason ?? (window ? null : `Nghỉ ${weekdayLabel(isoWeekdayOf(day))}`),
            serviceIds: [...s.serviceIds],
          }
        }),
      appointments: [...list].sort((a, b) => (a.startAt < b.startAt ? -1 : 1)).map((a) => cardDto(a, flags.get(a.customerId))),
    }
  },

  async getList(query: AppointmentQuery): Promise<PaginatedResult<AppointmentListItem>> {
    await begin(permissions.appointments.view)
    const items = appointmentsDb
      .filter(
        (a) =>
          (!query.customerId || a.customerId === query.customerId) &&
          (!query.from || a.date >= query.from) &&
          (!query.to || a.date <= query.to) &&
          (!query.status || a.status === query.status)
      )
      .map<AppointmentListItem>((a) => {
        const c = customersDb.get(a.customerId)
        const lines = [...a.lines].sort((x, y) => x.sortOrder - y.sortOrder)
        return {
          id: a.id,
          code: a.code,
          date: a.date,
          startAt: a.startAt,
          endAt: a.endAt,
          status: a.status,
          source: a.source,
          customerId: a.customerId,
          customerName: c?.fullName ?? '',
          customerPhone: c?.phone ?? '',
          services: lines.map((l) => l.serviceName).join(', '),
          staffNames: [...new Set(lines.map((l) => staffName(l.staffMemberId)))].join(', '),
          amount: lines.reduce((s, l) => s + l.price, 0),
          createdAt: a.createdAt,
        }
      })
    const digits = digitsOnly(query.search ?? '')
    const search = /^\d{3,}$/.test(digits) ? digits : query.search
    return listQuery(items, { ...query, search }, { searchFields: ['code', 'customerName', 'customerPhone'] })
  },

  async get(id: string): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.view)
    return detailDto(load(id), actor())
  },

  async check(input: CheckAppointmentInput): Promise<CheckResultDto> {
    await mockDelay(60, 140)
    requirePermission(permissions.appointments.create, permissions.appointments.update)
    ensureFresh()
    const existing = input.appointmentId ? appointmentsDb.get(input.appointmentId) : undefined
    if (!input.lines.length) return { ok: false, lines: [], issues: [{ code: 'SoDong', message: 'Thêm ít nhất một dịch vụ' }] }
    const built = buildDraft(input.lines, existing)
    if (!built) return { ok: false, lines: [], issues: [{ code: 'SoDong', message: 'Các dòng dịch vụ phải cùng một ngày' }] }
    const check = checkDraft(loadDay(built.date), built.draft, existing?.id ?? null, input.customerId ?? existing?.customerId ?? null)
    return toCheckResult(check, built.date)
  },

  async suggest(query: SuggestionQuery): Promise<SuggestionsDto> {
    await mockDelay(80, 160)
    requirePermission(permissions.appointments.create, permissions.appointments.update)
    ensureFresh()
    const service = servicesDb.get(query.serviceId)
    if (!service) throw notFoundError('Không tìm thấy dịch vụ.')
    const local = vnLocal(query.startAt)
    const day = loadDay(local.date)
    const result = suggest(
      day,
      { id: service.id, name: service.name, duration: service.durationMinutes, cleanup: service.cleanupMinutes, price: service.price },
      query.staffMemberId,
      local.minute,
      [],
      query.appointmentId ?? null
    )
    return {
      freeTechnicians: result.freeStaff.map((s) => {
        const r = staffDb.get(s.id)!
        return { id: r.id, code: r.code, fullName: r.fullName, kind: r.kind, color: r.color }
      }),
      nextSlots: result.nextSlots.map((m) => vnIso(local.date, m)),
    }
  },

  async create(input: CreateAppointmentInput): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.create)
    const errors = validateCreateAppointment(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const by = actor().fullName
    let customer: CustomerRecord
    let isNew = false
    if (input.customerId) {
      const found = customersDb.get(input.customerId)
      if (!found) throw notFoundError('Không tìm thấy khách.')
      customer = found
    } else {
      const phone = digitsOnly(input.newCustomer!.phone)
      const found = customersDb.find((c) => c.phone === phone)
      if (found) customer = found
      else {
        customer = {
          id: newId(),
          code: nextCustomerCode(),
          phone,
          fullName: input.newCustomer!.fullName.trim(),
          birthDate: null,
          gender: null,
          note: null,
          createdAt: nowIso(),
        }
        isNew = true
      }
    }
    const built = buildDraft(input.lines)
    if (!built) throw sameDayError()
    const check = checkDraft(loadDay(built.date), built.draft, null, isNew ? null : customer.id)
    if (!check.ok) throw scheduleError(check, built.date)

    const now = nowIso()
    let record: AppointmentRecord = refreshSpan({
      id: newId(),
      code: nextDocCode(bookingRules.appointmentPrefix, today()),
      customerId: customer.id,
      date: built.date,
      startAt: now,
      endAt: now,
      source: input.source,
      status: 'DaXacNhan',
      note: input.note?.trim() || null,
      createdByName: by,
      confirmedAt: now,
      confirmedByName: by,
      checkedInAt: null,
      checkedInByName: null,
      cancelReason: null,
      cancelNote: null,
      cancelledAt: null,
      cancelledByName: null,
      noShowAt: null,
      noShowByName: null,
      completedAt: null,
      reminderSentAt: null,
      createdAt: now,
      lines: built.draft.map((d, i) => newLine(d, built.date, i + 1)),
      messages: [],
    })
    record = addMessage(record, customer, 'XacNhan')
    mockDb.batch(() => {
      if (isNew) customersDb.insert(customer)
      appointmentsDb.insert(record)
    })
    return detailDto(record, actor())
  },

  async update(id: string, input: UpdateAppointmentInput): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.update)
    const a = load(id)
    if (!['ChoXacNhan', 'DaXacNhan', 'DangPhucVu'].includes(a.status))
      throw invalidState(`Lịch hẹn ${statusLabel(a.status).toLowerCase()}, không sửa được.`)
    if (!input.lines.length) throw fieldErrors({ lines: 'Lịch hẹn còn ít nhất một dịch vụ' })
    if (a.status === 'DangPhucVu') {
      const now = nowIso()
      for (const started of a.lines.filter((l) => l.startAt <= now)) {
        const sent = input.lines.find((l) => l.lineId === started.id)
        if (!sent || sent.staffMemberId !== started.staffMemberId || sent.serviceId !== started.serviceId || sent.startAt !== started.startAt)
          throw invalidState(`Dòng ${started.serviceName} đã bắt đầu, không đổi hoặc bỏ được.`)
      }
    }
    const built = buildDraft(input.lines, a)
    if (!built) throw sameDayError()
    const check = checkDraft(loadDay(built.date), built.draft, a.id, a.customerId)
    if (!check.ok) throw scheduleError(check, built.date)
    const { record, changed } = applyDraftLines(a, built.draft, built.date)
    let next: AppointmentRecord = { ...record, source: input.source ?? record.source, note: input.note?.trim() || null }
    if (changed && next.status !== 'DangPhucVu') next = addMessage(next, customersDb.get(a.customerId)!, 'DoiLich')
    appointmentsDb.update(id, next)
    return detailDto(appointmentsDb.get(id)!, actor())
  },

  async moveLine(id: string, lineId: string, input: MoveLineInput): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.update)
    const a = load(id)
    const line = a.lines.find((l) => l.id === lineId)
    if (!line) throw notFoundError('Không tìm thấy dòng dịch vụ.')
    const movable = EDITABLE.includes(a.status) || (a.status === 'DangPhucVu' && line.startAt > nowIso())
    if (!movable)
      throw invalidState(
        a.status === 'DangPhucVu'
          ? `Dòng ${line.serviceName} đã bắt đầu, không đổi giờ được.`
          : `Lịch hẹn ${statusLabel(a.status).toLowerCase()}, không đổi giờ được.`
      )
    const requests: DraftLineInput[] = a.lines.map((l) => ({
      lineId: l.id,
      serviceId: l.serviceId,
      staffMemberId: l.id === lineId ? input.staffMemberId : l.staffMemberId,
      startAt: l.id === lineId ? input.startAt : l.startAt,
    }))
    const built = buildDraft(requests, a)
    if (!built) throw sameDayError()
    const check = checkDraft(loadDay(built.date), built.draft, a.id, a.customerId)
    if (!check.ok) throw scheduleError(check, built.date)
    const { record, changed } = applyDraftLines(a, built.draft, built.date)
    if (changed) {
      const next = record.status !== 'DangPhucVu' ? addMessage(record, customersDb.get(a.customerId)!, 'DoiLich') : record
      appointmentsDb.update(id, next)
    }
    return detailDto(appointmentsDb.get(id)!, actor())
  },

  async confirm(id: string): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.update)
    return mutate(id, (a, customer, by) => {
      if (a.status !== 'ChoXacNhan') throw invalidState('Chỉ xác nhận được lịch đang chờ xác nhận.')
      return addMessage({ ...a, status: 'DaXacNhan', confirmedAt: nowIso(), confirmedByName: by }, customer, 'XacNhan')
    })
  },

  async reject(id: string, input: CancelAppointmentInput): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.update)
    const errors = validateCancel(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    return mutate(id, (a, customer, by) => {
      if (a.status !== 'ChoXacNhan') throw invalidState('Chỉ từ chối được lịch đang chờ xác nhận.')
      return cancelCore(a, customer, by, input)
    })
  },

  async cancel(id: string, input: CancelAppointmentInput): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.cancel)
    const errors = validateCancel(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    return mutate(id, (a, customer, by) => {
      if (!EDITABLE.includes(a.status)) throw invalidState(`Lịch hẹn ${statusLabel(a.status).toLowerCase()}, không hủy được.`)
      return cancelCore(a, customer, by, input)
    })
  },

  async checkIn(id: string): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.update)
    return mutate(id, (a, customer, by) => {
      if (a.date !== today() || !EDITABLE.includes(a.status)) throw invalidState('Chỉ check-in lịch của hôm nay đang chờ hoặc đã xác nhận.')
      const now = nowIso()
      const next: AppointmentRecord = { ...a, status: 'DangPhucVu', checkedInAt: now, checkedInByName: by }
      return a.status === 'ChoXacNhan' ? addMessage({ ...next, confirmedAt: now, confirmedByName: by }, customer, 'XacNhan') : next
    })
  },

  async noShow(id: string): Promise<AppointmentDetailDto> {
    await begin(permissions.appointments.update)
    return mutate(id, (a, _customer, by) => {
      if (!isLate(a)) throw invalidState('Chỉ đánh dấu không đến khi đã quá giờ hẹn 15 phút mà khách chưa check-in.')
      return { ...a, status: 'KhongDen', noShowAt: nowIso(), noShowByName: by }
    })
  },

  async checkoutPreview(id: string): Promise<CheckoutPreviewDto> {
    await begin(permissions.invoices.create)
    const a = load(id)
    const me = actor()
    const customer = customersDb.get(a.customerId)!
    const serviceIds = [...new Set(a.lines.map((l) => l.serviceId))]
    return {
      appointmentId: a.id,
      appointmentCode: a.code,
      status: a.status,
      customer: { id: customer.id, code: customer.code, fullName: customer.fullName, phone: customer.phone },
      lines: [...a.lines]
        .sort((x, y) => x.sortOrder - y.sortOrder)
        .map((l) => {
          const s = servicesDb.get(l.serviceId)
          return {
            appointmentLineId: l.id,
            serviceId: l.serviceId,
            serviceName: l.serviceName,
            staffMemberId: l.staffMemberId,
            staffName: staffName(l.staffMemberId),
            price: l.price,
            durationMinutes: l.durationMinutes,
            commissionType: s?.commissionType ?? 'PhanTram',
            commissionValue: s?.commissionValue ?? 0,
          }
        }),
      packages: customerPackages(customer.id, serviceIds),
      discountLimitPercent: discountLimitOf(can(me, permissions.invoices.discount), can(me, permissions.invoices.discountHigh)),
      today: today(),
    }
  },
}
