import demoData from '@/mock/seed/demo-data.json'
import { stableId } from '@/mock/mock-helpers'
import { systemSeed } from '@/mock/system-seed'
import { userIdOf } from '@/mock/system-data'
import type { AppointmentStatus, CancelReason, DiscountType, ShiftType } from '@/types/spa'
import type { SeedDay, SpaSeedFile } from '@/types/spa-seed'
import type { CheckoutDiscount } from '../lib/checkout'
import { buildMessage } from '../lib/messages'
import { bookingRules, commissionPeriodCode, docCode, docStem, floor15, overlaps } from '../lib/rules'
import {
  addDaysKey,
  isoWeekdayOf,
  monthKeyOf,
  parseHhmm,
  vnDateKey,
  vnIso,
  vnLocal,
  vnMinutesOfDay,
} from '../lib/vn-time'
import { applyDraft, computeDraft, type CheckoutDraft } from './invoice-builder'
import type {
  AppointmentRecord,
  CustomerRecord,
  DayOffRecord,
  GroupRecord,
  InvoiceRecord,
  PackageRecord,
  PeriodRecord,
  ServiceRecord,
  StaffRecord,
  TemplateRecord,
} from './records'

/**
 * Nạp demo-data.json theo 06 §5 giống hệt `DemoDataSeeder.cs`: danh mục; suy ngày giờ, trạng thái lịch theo lúc nạp;
 * bỏ lịch vướng kịch bản kiểm thử; chạy lại thanh toán, bán gói theo thời gian bằng `invoice-builder.ts`.
 */

export const demoDataFile = demoData as unknown as SpaSeedFile

export type SpaSeed = {
  groups: GroupRecord[]
  services: ServiceRecord[]
  templates: TemplateRecord[]
  staff: StaffRecord[]
  daysOff: DayOffRecord[]
  customers: CustomerRecord[]
  appointments: AppointmentRecord[]
  invoices: InvoiceRecord[]
  packages: PackageRecord[]
  periods: PeriodRecord[]
}

const RECEPTIONIST = 'nhanvien'
const nameOf = (username: string) => systemSeed.users.find((u) => u.username === username)?.fullName ?? username
const shiftOf = (c: string): ShiftType => (c === 'S' ? 'Sang' : c === 'C' ? 'Chieu' : c === 'F' ? 'CaNgay' : 'Nghi')
const iso = (ms: number) => new Date(ms).toISOString()
const minIso = (a: string, b: string) => (a < b ? a : b)

/** Đồng hồ của lần nạp (06 §5.3) */
function makeClock(anchor: number) {
  const now = Math.floor(anchor / 60_000) * 60_000
  const today = vnDateKey(now)
  const nowMinute = vnMinutesOfDay(now)
  const weekStart = addDaysKey(today, 1 - isoWeekdayOf(today))
  let testDay = addDaysKey(today, 2)
  while (isoWeekdayOf(testDay) !== 2) testDay = addDaysKey(testDay, 1)
  return {
    now,
    nowIso: iso(now),
    today,
    nowMinute,
    testDay,
    dayOf: (day: SeedDay) => (day.d !== undefined ? addDaysKey(today, day.d) : addDaysKey(weekStart, 7 * day.w![0] + day.w![1] - 1)),
    startMinute: (token: string, duration: number) => {
      if (!token.startsWith('~')) return parseHhmm(token)
      const minute = floor15(nowMinute + Number(token.slice(1)))
      return Math.min(Math.max(minute, bookingRules.defaultOpen), bookingRules.defaultClose - duration)
    },
    createdAt: (cr: number | undefined, ld: number | undefined, start: string) => {
      if (cr !== undefined) return iso(now + cr * 60_000)
      const created = new Date(start).getTime() - Math.round((ld ?? 24) * 60) * 60_000
      return created > now ? iso(now - 5 * 60_000) : iso(created)
    },
    customerCreatedAt: (cr: number) => {
      const at = new Date(vnIso(addDaysKey(today, cr), 600)).getTime()
      return iso(at > now ? now - 60_000 : at)
    },
    status: (outcome: string, source: string, date: string, start: string, end: string): AppointmentStatus => {
      const nowIso = iso(now)
      if (outcome === 'cancel') return 'DaHuy'
      if (date < today) return outcome === 'noshow' ? 'KhongDen' : 'HoanThanh'
      if (date === today && end <= nowIso) return outcome === 'done' ? 'HoanThanh' : outcome === 'noshow' ? 'KhongDen' : 'DaXacNhan'
      if (date === today && start <= nowIso) return outcome === 'done' ? 'DangPhucVu' : 'DaXacNhan'
      return outcome === 'pending' && source === 'Online' ? 'ChoXacNhan' : 'DaXacNhan'
    },
  }
}

type Resolved = {
  index: number
  seed: SpaSeedFile['appointments'][number]
  date: string
  lines: { service: ServiceRecord; staff: StaffRecord; start: number; startIso: string }[]
  fixture: boolean
  spanStart: number
  spanEnd: number
}

export function loadSpaSeed(anchor: number, storeName: string): SpaSeed {
  const data = demoDataFile
  const clock = makeClock(anchor)
  const baseCreated = iso(clock.now - 400 * 86_400_000)

  // 1) Danh mục, nhân viên, khách (06 §5.5 bước 1)
  const groups = data.serviceGroups.map<GroupRecord & { code: string }>((g, i) => ({
    id: stableId('service-group', g.code),
    code: g.code,
    name: g.name,
    sortOrder: (i + 1) * 10,
    isVisible: g.visible ?? true,
    createdAt: baseCreated,
  }))
  const groupByCode = new Map(groups.map((g) => [g.code, g]))
  const services = data.services.map<ServiceRecord>((s) => ({
    id: stableId('service', s.code),
    code: s.code,
    name: s.name,
    groupId: groupByCode.get(s.group)!.id,
    durationMinutes: s.dur,
    cleanupMinutes: s.clean,
    price: s.price,
    description: s.desc ?? null,
    imageUrl: s.img ? `/seed/services/${s.img}.webp` : null,
    allowOnline: s.online,
    commissionType: s.ct,
    commissionValue: s.cv,
    isVisible: s.visible ?? true,
    createdAt: baseCreated,
  }))
  const serviceByCode = new Map(services.map((s) => [s.code, s]))
  const serviceById = new Map(services.map((s) => [s.id, s]))
  const templates = data.packageTemplates.map<TemplateRecord>((t) => ({
    id: stableId('package-template', t.code),
    code: t.code,
    name: t.name,
    serviceId: serviceByCode.get(t.service)!.id,
    sessions: t.sessions,
    price: t.price,
    validityMonths: t.months,
    minIntervalDays: t.gap,
    commissionRate: t.rate,
    isActive: t.active ?? true,
    createdAt: baseCreated,
  }))
  const templateByCode = new Map(templates.map((t) => [t.code, t]))
  const staff = data.staff.map<StaffRecord>((s, i) => ({
    id: stableId('staff', s.code),
    code: s.code,
    fullName: s.name,
    phone: s.phone,
    kind: s.kind,
    color: s.color,
    specialty: s.specialty ?? null,
    userId: s.user && systemSeed.users.some((u) => u.username === s.user) ? userIdOf(s.user) : null,
    isActive: true,
    sortOrder: (i + 1) * 10,
    serviceIds: s.kind === 'KyThuatVien' ? s.services.map((c) => serviceByCode.get(c)!.id) : [],
    shifts: s.kind === 'KyThuatVien' ? [...s.week].map(shiftOf) : [],
    createdAt: baseCreated,
  }))
  const staffByCode = new Map(staff.map((s) => [s.code, s]))
  const staffById = new Map(staff.map((s) => [s.id, s]))
  const daysOff = data.daysOff.map<DayOffRecord>((d, i) => ({
    id: stableId('day-off', i),
    staffMemberId: d.staff ? staffByCode.get(d.staff)!.id : null,
    date: clock.dayOf(d),
    reason: d.reason,
    createdAt: baseCreated,
  }))
  const customers = data.customers.map<CustomerRecord>((c) => ({
    id: stableId('customer', c.code),
    code: c.code,
    phone: c.phone,
    fullName: c.name,
    birthDate: c.birth ?? null,
    gender: c.g ?? null,
    note: c.note ?? null,
    createdAt: clock.customerCreatedAt(c.cr),
  }))
  const customerByCode = new Map(customers.map((c) => [c.code, c]))

  // 2) Lịch hẹn: suy ngày giờ, cửa sổ 90/14 ngày, bỏ lịch vướng kịch bản kiểm thử (06 §5.5 bước 2)
  const resolved: Resolved[] = []
  data.appointments.forEach((a, index) => {
    const date = clock.dayOf(a)
    const fixture = a.fx === true
    if (!fixture && (date < addDaysKey(clock.today, -90) || date > addDaysKey(clock.today, 14))) return
    const lines = a.ln.map(([svcCode, staffCode, token]) => {
      const service = serviceByCode.get(svcCode)!
      const start = clock.startMinute(token, service.durationMinutes)
      return { service, staff: staffByCode.get(staffCode)!, start, startIso: vnIso(date, start) }
    })
    resolved.push({
      index,
      seed: a,
      date,
      lines,
      fixture,
      spanStart: Math.min(...lines.map((l) => l.start)),
      spanEnd: Math.max(...lines.map((l) => l.start + l.service.durationMinutes)),
    })
  })
  const fixtures = resolved.filter((r) => r.fixture)
  const dropped = (r: Resolved): boolean => {
    for (const hold of data.reserve) {
      for (const line of r.lines.filter((l) => hold.staff.includes(l.staff.code))) {
        if (hold.day === 'T' && r.date === clock.testDay) return true
        if (hold.d !== undefined && r.date === addDaysKey(clock.today, hold.d)) {
          const blockEnd = new Date(line.startIso).getTime() + (line.service.durationMinutes + line.service.cleanupMinutes) * 60_000
          if (hold.from !== 'now' || blockEnd > clock.now) return true
        }
      }
    }
    for (const f of fixtures.filter((x) => x.date === r.date)) {
      for (const line of r.lines) {
        for (const other of f.lines.filter((o) => o.staff.id === line.staff.id)) {
          if (
            overlaps(
              line.start,
              line.start + line.service.durationMinutes + line.service.cleanupMinutes,
              other.start,
              other.start + other.service.durationMinutes + other.service.cleanupMinutes
            )
          )
            return true
        }
      }
      if (f.seed.c === r.seed.c && overlaps(r.spanStart, r.spanEnd, f.spanStart, f.spanEnd)) return true
    }
    return false
  }
  const kept = resolved.filter((r) => r.fixture || !dropped(r))

  // 3) Thực thể lịch hẹn, mã theo ngày tạo (06 §5.4, §5.5 bước 3)
  const receptionistName = nameOf(RECEPTIONIST)
  const appointments: { source: Resolved; record: AppointmentRecord }[] = kept.map((r) => {
    const a = r.seed
    const apptId = stableId('appointment', a.id)
    const lines = r.lines.map((l, i) => ({
      id: stableId('appointment-line', a.id, i),
      serviceId: l.service.id,
      serviceName: l.service.name,
      price: l.service.price,
      durationMinutes: l.service.durationMinutes,
      cleanupMinutes: l.service.cleanupMinutes,
      staffMemberId: l.staff.id,
      startAt: l.startIso,
      endAt: iso(new Date(l.startIso).getTime() + l.service.durationMinutes * 60_000),
      sortOrder: i + 1,
    }))
    const sorted = [...lines].sort((x, y) => (x.startAt < y.startAt ? -1 : x.startAt > y.startAt ? 1 : x.sortOrder - y.sortOrder))
    sorted.forEach((l, i) => (l.sortOrder = i + 1))
    const start = lines.reduce((m, l) => (l.startAt < m ? l.startAt : m), lines[0].startAt)
    const end = lines.reduce((m, l) => (l.endAt > m ? l.endAt : m), lines[0].endAt)
    const created = clock.createdAt(a.cr, a.ld, start)
    const status = a.st ?? clock.status(a.o ?? 'done', a.src, r.date, start, end)
    const customer = customerByCode.get(a.c)!
    const record: AppointmentRecord = {
      id: apptId,
      code: '',
      customerId: customer.id,
      date: vnDateKey(start),
      startAt: start,
      endAt: end,
      source: a.src,
      status,
      note: a.nt ?? null,
      createdByName: a.src === 'Online' ? bookingRules.onlineCreatorName : receptionistName,
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
      createdAt: created,
      lines,
      messages: [],
    }
    applyTimeline(record, a, created, clock.nowIso, receptionistName, customer)
    return { source: r, record }
  })

  const counters = new Map<string, number>()
  const nextCode = (prefix: string, date: string) => {
    const stem = docStem(prefix, date)
    const n = (counters.get(stem) ?? 0) + 1
    counters.set(stem, n)
    return docCode(prefix, date, n)
  }
  ;[...appointments]
    .sort((x, y) => (x.record.createdAt < y.record.createdAt ? -1 : x.record.createdAt > y.record.createdAt ? 1 : x.source.index - y.source.index))
    .forEach((x) => (x.record.code = nextCode(bookingRules.appointmentPrefix, vnDateKey(x.record.createdAt))))

  // 4) Sự kiện tiền theo thời gian (06 §5.5 bước 4)
  const invoices: InvoiceRecord[] = []
  const packages: PackageRecord[] = []
  const usageDates = new Map<string, string[]>()
  const packagesOf = (customerId: string) => packages.filter((p) => p.customerId === customerId)
  const lastUsed = (packageId: string): string | null => {
    const list = usageDates.get(packageId)
    if (!list?.length) return null
    return vnDateKey(list.reduce((m, x) => (x > m ? x : m)))
  }
  const record = (outcome: ReturnType<typeof applyDraft>) => {
    invoices.push(outcome.invoice)
    packages.push(...outcome.newPackages)
    for (const line of outcome.invoice.lines)
      if (line.usesPackage && line.customerPackageId) {
        const list = usageDates.get(line.customerPackageId) ?? []
        list.push(outcome.invoice.paidAt)
        usageDates.set(line.customerPackageId, list)
      }
  }

  type Event = { at: string; kind: number; index: number; run: () => void }
  const events: Event[] = []
  data.packageSales.forEach((sale, index) => {
    const at = vnIso(clock.dayOf(sale), parseHhmm(sale.t))
    if (new Date(at).getTime() > clock.now) return
    events.push({
      at,
      kind: 0,
      index,
      run: () => {
        const customer = customerByCode.get(sale.c)!
        const template = templateByCode.get(sale.tpl)!
        const consultant = staffByCode.get(sale.by)!
        const draft: CheckoutDraft = {
          appointment: null,
          customer,
          lines: [],
          packages: [],
          lastUsedDate: () => null,
          sales: [{ template, serviceName: serviceById.get(template.serviceId)!.name, consultantId: consultant.id, consultantName: consultant.fullName }],
          discount: null,
          discountLimitPercent: bookingRules.managerDiscountLimit,
          method: sale.m,
          now: at,
          cashierName: receptionistName,
        }
        const outcome = checkout(draft, index + 5000, (p) => nextCode(p, vnDateKey(at)))
        if (sale.exp !== undefined) {
          const pkg = outcome.newPackages[0]
          pkg.expiryDate = addDaysKey(clock.today, sale.exp)
          for (const line of outcome.invoice.lines) if (line.customerPackageId === pkg.id) line.packageExpiryDate = pkg.expiryDate
        }
        record(outcome)
      },
    })
  })

  for (const { source, record: appointment } of appointments.filter((x) => x.record.status === 'HoanThanh')) {
    const paidAt = appointment.completedAt!
    const pay = source.seed.pay ?? { m: 'TienMat' as const }
    events.push({
      at: paidAt,
      kind: 1,
      index: source.index,
      run: () => {
        const customer = customerByCode.get(source.seed.c)!
        const sales = (pay.sell ?? []).map(([tpl, by]) => {
          const template = templateByCode.get(tpl)!
          const consultant = staffByCode.get(by)!
          return { template, serviceName: serviceById.get(template.serviceId)!.name, consultantId: consultant.id, consultantName: consultant.fullName }
        })
        const relevant = new Set([...appointment.lines.map((l) => l.serviceId), ...sales.map((s) => s.template.serviceId)])
        const draft: CheckoutDraft = {
          appointment,
          customer,
          lines: [...appointment.lines]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((line) => {
              const service = serviceById.get(line.serviceId)!
              return {
                line,
                staffName: staffById.get(line.staffMemberId)!.fullName,
                commissionType: service.commissionType,
                commissionValue: service.commissionValue,
              }
            }),
          packages: packagesOf(customer.id).filter((p) => relevant.has(p.serviceId)),
          lastUsedDate: lastUsed,
          sales,
          discount: discountOf(pay.disc),
          discountLimitPercent: bookingRules.managerDiscountLimit,
          method: pay.m,
          overrideReason: pay.ovr ?? null,
          now: paidAt,
          cashierName: nameOf(pay.by ?? RECEPTIONIST),
        }
        record(checkout(draft, source.index, (p) => nextCode(p, vnDateKey(paidAt))))
      },
    })
  }

  events
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind - b.kind || a.index - b.index))
    .forEach((e) => e.run())

  // 5) Gói quá hạn còn buổi (06 §5.5 bước 5)
  for (const p of packages)
    if (p.status === 'DangDung' && p.expiryDate < clock.today && p.totalSessions - p.usedSessions > 0) p.status = 'HetHan'

  // 6) Bảng hoa hồng tháng (06 §5.5 bước 6)
  const currentMonth = monthKeyOf(clock.today)
  const months = [
    ...new Set(invoices.filter((i) => i.status === 'DaThanhToan').map((i) => monthKeyOf(vnDateKey(i.paidAt)))),
  ].sort((a, b) => a - b)
  const periods = months.map<PeriodRecord>((month) => {
    const age = (Math.floor(currentMonth / 100) - Math.floor(month / 100)) * 12 + ((currentMonth % 100) - (month % 100))
    const nextMonth = `${month % 100 === 12 ? Math.floor(month / 100) + 1 : Math.floor(month / 100)}-${String((month % 100) % 12 + 1).padStart(2, '0')}-01`
    return {
      id: stableId('commission-period', month),
      code: commissionPeriodCode(month),
      month,
      status: age >= 3 ? 'DaChiTra' : age >= 2 ? 'DaChot' : 'TamTinh',
      closedAt: age >= 2 ? vnIso(nextMonth, 9 * 60) : null,
      closedByName: age >= 2 ? nameOf('quanly') : null,
      paidAt: age >= 3 ? vnIso(addDaysKey(nextMonth, 4), 10 * 60) : null,
      paidByName: age >= 3 ? nameOf('quanly') : null,
    }
  })

  // 7) Tin xác nhận của lịch sắp tới (06 §5.5 bước 7)
  for (const { record: a } of appointments.filter((x) => x.record.status === 'DaXacNhan' && x.record.date >= clock.today)) {
    const customer = customers.find((c) => c.id === a.customerId)!
    const names = [...a.lines].sort((x, y) => x.sortOrder - y.sortOrder).map((l) => l.serviceName).join(', ')
    a.messages.push({
      id: stableId('appointment-message', a.id),
      kind: 'XacNhan',
      channel: 'Zalo',
      content: buildMessage('XacNhan', storeName, a.code, a.date, vnLocal(a.startAt).minute, names, customer.fullName, customer.gender),
      sentAt: a.confirmedAt ?? a.createdAt,
    })
  }

  return {
    groups: groups.map((x) => {
      const { code, ...g } = x
      void code
      return g
    }),
    services,
    templates,
    staff,
    daysOff,
    customers,
    appointments: appointments.map((x) => x.record),
    invoices,
    packages,
    periods,
  }
}

/** Thanh toán một sự kiện: lý do BR-19 thiếu thì dòng đó trả lẻ; giảm giá lỗi thì bỏ giảm (giống `Checkout` của BE) */
function checkout(draft: CheckoutDraft, index: number, nextCode: (prefix: string) => string) {
  let current = draft
  let result = computeDraft(current)
  if (Object.keys(result.errors).length > 0 && current.discount) {
    current = { ...current, discount: null }
    result = computeDraft(current)
  }
  for (let attempt = 0; attempt < 5 && result.requiresOverrideReason && !current.overrideReason?.trim(); attempt++) {
    const retail = new Set(result.lines.filter((l) => l.usesPackage && l.intervalWarning !== null).map((l) => l.line.lineId))
    const map = Object.fromEntries(result.lines.map((l) => [l.line.lineId, l.usesPackage && !retail.has(l.line.lineId)]))
    current = { ...current, usePackage: map }
    result = computeDraft(current)
  }
  const total = result.total
  current = {
    ...current,
    cashReceived: current.method === 'TienMat' ? Math.ceil(total / 50000) * 50000 : null,
    cardAuthCode: current.method === 'The' ? String(((index * 7919 + 104729) % 900000) + 100000) : null,
  }
  return applyDraft(current, result, nextCode, stableId)
}

function discountOf(raw: [string, number, string?] | undefined): CheckoutDiscount | null {
  if (!raw || raw.length < 2) return null
  return { type: raw[0] as DiscountType, value: raw[1], reason: raw[2] ?? null }
}

/** Mốc thời gian theo trạng thái (06 §5.4) */
function applyTimeline(
  a: AppointmentRecord,
  seed: SpaSeedFile['appointments'][number],
  created: string,
  nowIso: string,
  receptionist: string,
  customer: CustomerRecord
) {
  const startMs = new Date(a.startAt).getTime()
  const online = a.source === 'Online'
  if (a.status === 'DaXacNhan' || a.status === 'DangPhucVu' || a.status === 'HoanThanh' || a.status === 'KhongDen') {
    a.confirmedAt = online ? minIso(iso(new Date(created).getTime() + 15 * 60_000), nowIso) : created
    a.confirmedByName = receptionist
  }
  if (a.status === 'DangPhucVu' || a.status === 'HoanThanh') {
    a.checkedInAt = iso(startMs - 5 * 60_000)
    a.checkedInByName = receptionist
  }
  if (a.status === 'HoanThanh') a.completedAt = minIso(iso(new Date(a.endAt).getTime() + 5 * 60_000), nowIso)
  if (a.status === 'KhongDen') {
    a.noShowAt = iso(startMs + 20 * 60_000)
    a.noShowByName = receptionist
  }
  if (a.status === 'DaHuy') {
    const reason = (seed.cx?.[0] as CancelReason | undefined) ?? 'KhachBaoHuy'
    a.cancelReason = reason
    a.cancelNote = seed.cx?.[1] ?? null
    const at = minIso(iso(startMs - 60 * 60_000), iso(new Date(created).getTime() + 30 * 60_000))
    a.cancelledAt = minIso(at < created ? created : at, nowIso)
    a.cancelledByName = reason === 'KhachTuHuy' ? customer.fullName : receptionist
  }
}
