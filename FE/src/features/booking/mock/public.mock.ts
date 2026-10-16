import { mockDelay } from '@/lib/data-source'
import { readJson, writeJson, storageKey } from '@/lib/storage'
import { mockDb } from '@/mock/mock-db'
import { newId } from '@/mock/mock-helpers'
import type { PublicAppointmentDto, PublicBookingInput, PublicCatalogDto, PublicSlotsDto, PublicSlotsQuery } from '@/types/spa'
import { buildMessage } from '../lib/messages'
import { bookingRules, digitsOnly, maskPhone } from '../lib/rules'
import { assignOnline, checkDraft, onlineSlots, scheduleCodes, type ScheduleService } from '../lib/schedule'
import { phoneError } from '../lib/validation'
import { addDaysKey, hhmm, vnDateKey, vnIso, vnLocal, vnStartOfDay } from '../lib/vn-time'
import { refreshSpan } from './appointment.mock'
import { nextCustomerCode } from './customer.mock'
import { conflictError, domainError, errorCodes, fieldErrors, invalidState, notFoundError, tooManyRequests } from './errors'
import { technicianMap } from './mappers'
import type { AppointmentRecord, CustomerRecord, ServiceRecord } from './records'
import {
  appointmentsDb,
  customersDb,
  ensureFresh,
  groupsDb,
  hours,
  loadDay,
  nextDocCode,
  nowIso,
  servicesDb,
  staffDb,
  staffName,
  store,
  today,
} from './store'

/** Handler mock trang đặt lịch, tra cứu, khách tự hủy (07 §3.3, §4.5; NFR-04, NFR-05). Không cần đăng nhập. */

/** Dịch vụ hiện trên trang đặt online (BR-06) */
function onlineServices(): ServiceRecord[] {
  const technicians = technicianMap()
  return servicesDb.filter((s) => s.isVisible && s.allowOnline && groupsDb.get(s.groupId)?.isVisible !== false && (technicians.get(s.id)?.length ?? 0) > 0)
}

function resolveServices(ids: string[]): ScheduleService[] {
  const online = new Map(onlineServices().map((s) => [s.id, s]))
  return ids
    .filter((id) => online.has(id))
    .map((id) => online.get(id)!)
    .map((s) => ({ id: s.id, name: s.name, duration: s.durationMinutes, cleanup: s.cleanupMinutes, price: s.price }))
}

/** Mốc sớm nhất đặt được trong ngày: cách hiện tại ít nhất 2 giờ (BR-06) */
function minStart(date: string): number {
  const earliest = Date.now() + bookingRules.onlineMinLeadMinutes * 60_000
  return Math.ceil((earliest - vnStartOfDay(date)) / 60_000)
}

const canSelfCancel = (a: AppointmentRecord) =>
  (a.status === 'ChoXacNhan' || a.status === 'DaXacNhan') &&
  new Date(a.startAt).getTime() - Date.now() >= bookingRules.selfCancelMinLeadMinutes * 60_000

function toPublic(a: AppointmentRecord): PublicAppointmentDto {
  const customer = customersDb.get(a.customerId)!
  return {
    code: a.code,
    status: a.status,
    date: a.date,
    startAt: a.startAt,
    endAt: a.endAt,
    total: a.lines.reduce((s, l) => s + l.price, 0),
    phoneMasked: maskPhone(customer.phone),
    customerName: customer.fullName,
    canCancel: canSelfCancel(a),
    hotline: store().hotline,
    lines: [...a.lines]
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map((l) => ({ serviceName: l.serviceName, staffName: staffName(l.staffMemberId), startAt: l.startAt, endAt: l.endAt, price: l.price })),
  }
}

// Khóa tra cứu theo thiết bị: sai 5 lần trong 15 phút thì khóa 15 phút (NFR-05)
const LOOKUP_KEY = storageKey('lookup-failures')
const WINDOW_MS = 15 * 60_000
type LookupState = { failures: number[]; lockedUntil: number | null }

function findForLookup(code: string, phone: string): AppointmentRecord {
  const state = readJson<LookupState>('local', LOOKUP_KEY) ?? { failures: [], lockedUntil: null }
  const now = Date.now()
  if (state.lockedUntil && state.lockedUntil > now)
    throw tooManyRequests('Bạn đã nhập sai 5 lần, vui lòng thử lại sau 15 phút', Math.ceil((state.lockedUntil - now) / 1000))
  const normalized = code.trim().toUpperCase()
  const digits = digitsOnly(phone)
  const found = appointmentsDb.find((a) => a.code === normalized && customersDb.get(a.customerId)?.phone === digits)
  if (found) {
    writeJson('local', LOOKUP_KEY, { failures: [], lockedUntil: null })
    return found
  }
  const failures = state.failures.filter((t) => now - t <= WINDOW_MS).concat(now)
  writeJson(
    'local',
    LOOKUP_KEY,
    failures.length >= 5 ? { failures: [], lockedUntil: now + WINDOW_MS } : { failures, lockedUntil: null }
  )
  throw notFoundError('Không tìm thấy lịch hẹn với mã và số điện thoại này', 'KhongTimThay')
}

export const publicMock = {
  async getCatalog(): Promise<PublicCatalogDto> {
    await mockDelay()
    ensureFresh()
    const shop = store()
    const { open, close } = hours()
    const online = onlineServices()
    const onlineIds = new Set(online.map((s) => s.id))
    const groups = groupsDb
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => ({
        id: g.id,
        name: g.name,
        services: online
          .filter((s) => s.groupId === g.id)
          .sort((a, b) => (a.code < b.code ? -1 : 1))
          .map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            description: s.description,
            imageUrl: s.imageUrl,
            durationMinutes: s.durationMinutes,
            price: s.price,
          })),
      }))
      .filter((g) => g.services.length > 0)
    return {
      shop: { name: shop.name, address: shop.address, hotline: shop.hotline, logoUrl: shop.logoUrl },
      openTime: hhmm(open),
      closeTime: hhmm(close),
      groups,
      technicians: staffDb
        .filter((s) => s.isActive && s.kind === 'KyThuatVien' && s.serviceIds.some((id) => onlineIds.has(id)))
        .sort((a, b) => a.sortOrder - b.sortOrder || (a.code < b.code ? -1 : 1))
        .map((s) => ({
          id: s.id,
          fullName: s.fullName,
          specialty: s.specialty,
          color: s.color,
          serviceIds: s.serviceIds.filter((id) => onlineIds.has(id)),
        })),
    }
  },

  async getSlots(query: PublicSlotsQuery): Promise<PublicSlotsDto> {
    await mockDelay(150, 300)
    ensureFresh()
    const date = query.date || today()
    const chosen = resolveServices([...new Set(query.serviceIds)].slice(0, bookingRules.onlineMaxServices))
    const last = addDaysKey(today(), bookingRules.onlineMaxDaysAhead)
    if (!chosen.length || date < today() || date > last) return { date, slots: [], nextAvailableDate: null, closedReason: null }
    const staffId = query.staffMemberId || null
    const day = loadDay(date)
    const slots = onlineSlots(day, chosen, staffId, minStart(date))
    let next: string | null = null
    if (!slots.length) {
      for (let d = addDaysKey(date, 1); d <= last; d = addDaysKey(d, 1)) {
        if (onlineSlots(loadDay(d), chosen, staffId, minStart(d)).length) {
          next = d
          break
        }
      }
    }
    return { date, slots: slots.map(hhmm), nextAvailableDate: next, closedReason: day.closedReason }
  },

  async book(input: PublicBookingInput): Promise<PublicAppointmentDto> {
    await mockDelay()
    ensureFresh()
    const errors: Record<string, string> = {}
    if (!input.serviceIds?.length) errors.serviceIds = 'Chọn ít nhất một dịch vụ'
    else if (input.serviceIds.length > 3) errors.serviceIds = 'Chọn tối đa 3 dịch vụ'
    if (!input.fullName?.trim()) errors.fullName = 'Nhập họ tên'
    const phone = phoneError(input.phone)
    if (phone) errors.phone = phone
    if (Object.keys(errors).length) throw fieldErrors(errors)

    const chosen = resolveServices(input.serviceIds)
    if (chosen.length !== input.serviceIds.length) throw fieldErrors({ serviceIds: 'Dịch vụ không còn nhận đặt online' })
    const local = vnLocal(input.startAt)
    const taken = () => conflictError(errorCodes.gioDaCoNguoiDat, 'Giờ này vừa có người đặt, vui lòng chọn giờ khác')
    if (local.date > addDaysKey(today(), bookingRules.onlineMaxDaysAhead) || local.minute < minStart(local.date) || local.minute % 30 !== 0)
      throw taken()
    const day = loadDay(local.date)
    const assignment = assignOnline(day, chosen, input.staffMemberId || null, local.minute)
    if (!assignment) throw taken()

    const digits = digitsOnly(input.phone)
    const fullName = input.fullName.trim()
    let customer = customersDb.find((c) => c.phone === digits)
    let note = input.note?.trim() || null
    let isNew = false
    if (customer) {
      const now = nowIso()
      const pending = appointmentsDb.count(
        (a) =>
          a.customerId === customer!.id &&
          a.source === 'Online' &&
          a.startAt > now &&
          (a.status === 'ChoXacNhan' || a.status === 'DaXacNhan')
      )
      if (pending >= bookingRules.onlineMaxPendingPerPhone)
        throw domainError(errorCodes.quaSoLichCho, 'Số điện thoại này đã có 2 lịch đang chờ, vui lòng gọi tiệm')
      const check = checkDraft(
        day,
        assignment.map((a) => ({ lineId: null, service: a.service, staffId: a.staffId, start: a.start })),
        null,
        customer.id
      )
      const clash = check.issues.find((i) => i.code === scheduleCodes.trungLichKhach)
      if (clash)
        throw conflictError(errorCodes.trungLichKhach, `${clash.message.replace('Khách đã có lịch', 'Bạn đã có lịch')}, vui lòng chọn giờ khác`)
      if (customer.fullName.toLowerCase() !== fullName.toLowerCase())
        note = note ? `${note}. Tên khách nhập: ${fullName}` : `Tên khách nhập: ${fullName}`
    } else {
      customer = { id: newId(), code: nextCustomerCode(), phone: digits, fullName, birthDate: null, gender: null, note: null, createdAt: nowIso() }
      isNew = true
    }

    const now = nowIso()
    const record = refreshSpan({
      id: newId(),
      code: nextDocCode(bookingRules.appointmentPrefix, today()),
      customerId: customer.id,
      date: local.date,
      startAt: now,
      endAt: now,
      source: 'Online',
      status: 'ChoXacNhan',
      note,
      createdByName: bookingRules.onlineCreatorName,
      confirmedAt: null,
      confirmedByName: null,
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
      lines: assignment.map((a, i) => {
        const startAt = vnIso(local.date, a.start)
        return {
          id: newId(),
          serviceId: a.service.id,
          serviceName: a.service.name,
          price: a.service.price,
          durationMinutes: a.service.duration,
          cleanupMinutes: a.service.cleanup,
          staffMemberId: a.staffId,
          startAt,
          endAt: new Date(new Date(startAt).getTime() + a.service.duration * 60_000).toISOString(),
          sortOrder: i + 1,
        }
      }),
      messages: [],
    })
    const c = customer as CustomerRecord
    mockDb.batch(() => {
      if (isNew) customersDb.insert(c)
      appointmentsDb.insert(record)
    })
    return toPublic(record)
  },

  async lookup(code: string, phone: string): Promise<PublicAppointmentDto> {
    await mockDelay()
    ensureFresh()
    return toPublic(findForLookup(code, phone))
  },

  async cancel(code: string, phone: string, reason?: string | null): Promise<PublicAppointmentDto> {
    await mockDelay()
    ensureFresh()
    const a = findForLookup(code, phone)
    if (!canSelfCancel(a)) throw invalidState(`Lịch bắt đầu trong vòng 2 giờ hoặc đã xử lý, vui lòng gọi tiệm ${store().hotline}`)
    const customer = customersDb.get(a.customerId)!
    const note = reason?.trim() || null
    const local = vnLocal(a.startAt)
    const names = [...a.lines].sort((x, y) => x.sortOrder - y.sortOrder).map((l) => l.serviceName).join(', ')
    const next: AppointmentRecord = {
      ...a,
      status: 'DaHuy',
      cancelReason: 'KhachTuHuy',
      cancelNote: note,
      cancelledAt: nowIso(),
      cancelledByName: customer.fullName,
      messages: [
        ...a.messages,
        {
          id: newId(),
          kind: 'Huy',
          channel: 'Zalo',
          content: buildMessage('Huy', store().name, a.code, local.date, local.minute, names, customer.fullName, customer.gender, note ?? 'Khách tự hủy online'),
          sentAt: nowIso(),
        },
      ],
    }
    appointmentsDb.update(a.id, next)
    return toPublic(next)
  },
}

export const _publicInternal = { vnDateKey }
