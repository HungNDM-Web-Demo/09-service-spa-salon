import demoData from '@/mock/seed/demo-data.json'
import { mockDb } from '@/mock/mock-db'
import { currentContext } from '@/mock/mock-auth'
import { getSettingsMap } from '@/mock/system-data'
import type { CustomerDto, CustomerPackageBrief } from '@/types/spa'
import { bookingRules, docCode, docStem, isOccupying } from '../lib/rules'
import type { DaySchedule } from '../lib/schedule'
import { addDaysKey, isoWeekdayOf, vnDateKey, vnLocal, vnMinutesOfDay, vnNow, vnStartOfDay } from '../lib/vn-time'
import type {
  AppointmentRecord,
  CustomerRecord,
  DayOffRecord,
  GroupRecord,
  HoursRecord,
  InvoiceRecord,
  MetaRecord,
  PackageRecord,
  PeriodRecord,
  ServiceRecord,
  StaffRecord,
  TemplateRecord,
} from './records'
import { loadSpaSeed, type SpaSeed } from './seed-loader'

/**
 * Kho dữ liệu mock của nghiệp vụ Spa: các collection mock-db nạp từ seed-loader (06 §5). Mọi collection dùng chung một
 * mốc nạp (meta.anchor); sang ngày mới thì nạp lại để "hôm nay" của dữ liệu mẫu luôn đúng.
 */

mockDb.registerSeed('demo-data', demoData)

let cache: { anchor: number; seed: SpaSeed } | null = null

function storeName(): string {
  const settings = getSettingsMap()
  return settings['Store.Name'] || settings['Brand.AppName'] || 'Spa'
}

const metaDb = mockDb.collection<MetaRecord>('spa-meta', () => {
  const anchor = vnNow()
  cache = null
  return [{ id: 'meta', anchor, date: vnDateKey(anchor) }]
})

function seed(): SpaSeed {
  const anchor = metaDb.get('meta')?.anchor ?? vnNow()
  if (!cache || cache.anchor !== anchor) cache = { anchor, seed: loadSpaSeed(anchor, storeName()) }
  return cache.seed
}

export const groupsDb = mockDb.collection<GroupRecord>('spa-service-groups', () => seed().groups)
export const servicesDb = mockDb.collection<ServiceRecord>('spa-services', () => seed().services)
export const templatesDb = mockDb.collection<TemplateRecord>('spa-package-templates', () => seed().templates)
export const hoursDb = mockDb.collection<HoursRecord>('spa-business-hours', () => [
  { id: 'hours', openMinute: bookingRules.defaultOpen, closeMinute: bookingRules.defaultClose },
])
export const staffDb = mockDb.collection<StaffRecord>('spa-staff', () => seed().staff)
export const daysOffDb = mockDb.collection<DayOffRecord>('spa-days-off', () => seed().daysOff)
export const customersDb = mockDb.collection<CustomerRecord>('spa-customers', () => seed().customers)
export const appointmentsDb = mockDb.collection<AppointmentRecord>('spa-appointments', () => seed().appointments)
export const invoicesDb = mockDb.collection<InvoiceRecord>('spa-invoices', () => seed().invoices)
export const packagesDb = mockDb.collection<PackageRecord>('spa-customer-packages', () => seed().packages)
export const periodsDb = mockDb.collection<PeriodRecord>('spa-commission-periods', () => seed().periods)

const ALL = [
  groupsDb,
  servicesDb,
  templatesDb,
  hoursDb,
  staffDb,
  daysOffDb,
  customersDb,
  appointmentsDb,
  invoicesDb,
  packagesDb,
  periodsDb,
]

mockDb.onReset(() => {
  cache = null
})

/**
 * Gọi đầu mỗi handler: dữ liệu nạp từ hôm trước thì nạp lại theo hôm nay; chạy việc nền (06 §3) như BE làm định kỳ.
 */
export function ensureFresh(): void {
  const meta = metaDb.get('meta')
  if (meta && meta.date !== vnDateKey(vnNow())) {
    mockDb.batch(() => {
      metaDb.reseed()
      for (const c of ALL) c.reseed()
    })
    cache = null
  }
  runMaintenance()
}

// ───────────────────────────── Đồng hồ, người thao tác

export const nowIso = (): string => new Date(Math.floor(vnNow() / 1000) * 1000).toISOString()
export const today = (): string => vnDateKey(vnNow())

export type Actor = { userId: string | null; fullName: string; permissions: string[]; isSuperAdmin: boolean }

export function actor(): Actor {
  const ctx = currentContext()
  if (!ctx) return { userId: null, fullName: bookingRules.systemActorName, permissions: [], isSuperAdmin: false }
  return { userId: ctx.user.id, fullName: ctx.user.fullName, permissions: ctx.permissions, isSuperAdmin: ctx.isSuperAdmin }
}

export const can = (a: Actor, code: string): boolean => a.isSuperAdmin || a.permissions.includes(code)

export function hours(): { open: number; close: number } {
  const row = hoursDb.get('hours')
  return { open: row?.openMinute ?? bookingRules.defaultOpen, close: row?.closeMinute ?? bookingRules.defaultClose }
}

export function store(): { name: string; address: string; hotline: string; logoUrl: string | null; bankBin: string; bankAccount: string; bankAccountName: string } {
  const s = getSettingsMap()
  return {
    name: s['Store.Name'] || s['Brand.AppName'] || 'Spa',
    address: s['Store.Address'] || '',
    hotline: s['Store.Hotline'] || s['Company.Hotline'] || '',
    logoUrl: s['Brand.LogoUrl'] || null,
    bankBin: s['Store.BankBin'] || '',
    bankAccount: s['Store.BankAccount'] || '',
    bankAccountName: s['Store.BankAccountName'] || '',
  }
}

// ───────────────────────────── Lịch một ngày cho ScheduleEngine

const minutesOn = (dateKey: string, iso: string) => Math.round((new Date(iso).getTime() - vnStartOfDay(dateKey)) / 60_000)

export function loadDay(date: string): DaySchedule {
  const { open, close } = hours()
  const offs = daysOffDb.filter((d) => d.date === date)
  const closed = offs.find((d) => d.staffMemberId === null)
  const weekday = isoWeekdayOf(date)
  const staff = staffDb
    .filter((s) => s.kind === 'KyThuatVien')
    .map((s) => ({
      id: s.id,
      code: s.code,
      fullName: s.fullName,
      isActive: s.isActive,
      isTechnician: true,
      shift: s.shifts[weekday - 1] ?? 'Nghi',
      dayOffReason: offs.find((d) => d.staffMemberId === s.id)?.reason ?? null,
      serviceIds: new Set(s.serviceIds),
      sortOrder: s.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.code < b.code ? -1 : 1))
  const occupying = appointmentsDb.filter((a) => a.date === date && isOccupying(a.status))
  return {
    date,
    today: today(),
    nowMinute: vnMinutesOfDay(vnNow()),
    open,
    close,
    closedReason: closed?.reason ?? null,
    staff,
    busy: occupying.flatMap((a) =>
      a.lines.map((l) => ({
        lineId: l.id,
        appointmentId: a.id,
        staffId: l.staffMemberId,
        start: minutesOn(date, l.startAt),
        end: minutesOn(date, l.endAt),
        cleanup: l.cleanupMinutes,
      }))
    ),
    customerSpans: occupying.map((a) => ({
      appointmentId: a.id,
      customerId: a.customerId,
      code: a.code,
      start: minutesOn(date, a.startAt),
      end: minutesOn(date, a.endAt),
    })),
  }
}

// ───────────────────────────── Mã chứng từ

export function nextDocCode(prefix: string, dateKey: string, reserved?: Map<string, number>): string {
  const stem = docStem(prefix, dateKey)
  let last = reserved?.get(stem)
  if (last === undefined) {
    const codes =
      prefix === bookingRules.appointmentPrefix
        ? appointmentsDb.all().map((a) => a.code)
        : prefix === bookingRules.invoicePrefix
          ? invoicesDb.all().map((i) => i.code)
          : packagesDb.all().map((p) => p.code)
    last = codes.filter((c) => c.startsWith(stem)).reduce((m, c) => Math.max(m, Number(c.slice(stem.length)) || 0), 0)
  }
  reserved?.set(stem, last + 1)
  return docCode(prefix, dateKey, last + 1)
}

export function nextCatalogCode(codes: string[], prefix: string, digits: number): string {
  const max = codes
    .map((c) => /^([A-Z]+)(\d+)$/.exec(c))
    .filter((m): m is RegExpExecArray => !!m && m[1] === prefix)
    .reduce((acc, m) => Math.max(acc, Number(m[2])), 0)
  return `${prefix}${String(max + 1).padStart(digits, '0')}`
}

// ───────────────────────────── Khách, gói

export function noShowCount90(customerId: string): number {
  const since = addDaysKey(today(), -bookingRules.noShowWindowDays)
  return appointmentsDb.count((a) => a.customerId === customerId && a.status === 'KhongDen' && a.date >= since)
}

export function customerDto(c: CustomerRecord): CustomerDto {
  const noShow = noShowCount90(c.id)
  const visits = appointmentsDb.filter((a) => a.customerId === c.id && a.status === 'HoanThanh')
  return {
    id: c.id,
    code: c.code,
    phone: c.phone,
    fullName: c.fullName,
    birthDate: c.birthDate,
    gender: c.gender,
    note: c.note,
    createdAt: c.createdAt,
    noShowCount90: noShow,
    isFlagged: noShow >= bookingRules.noShowFlagThreshold,
    totalSpent: invoicesDb.filter((i) => i.customerId === c.id && i.status === 'DaThanhToan').reduce((s, i) => s + i.total, 0),
    visitCount: visits.length,
    lastVisitAt: visits.reduce<string | null>((m, a) => (!m || a.startAt > m ? a.startAt : m), null),
    activePackageCount: packagesDb.count((p) => p.customerId === c.id && p.status === 'DangDung'),
  }
}

/** Lần trừ buổi chưa hoàn trả của gói, suy từ dòng hóa đơn đã thanh toán */
export function packageUsageTimes(packageId: string): string[] {
  return invoicesDb
    .filter((i) => i.status === 'DaThanhToan' && i.lines.some((l) => l.usesPackage && l.customerPackageId === packageId))
    .map((i) => i.paidAt)
}

export function lastUsedAt(packageId: string): string | null {
  return packageUsageTimes(packageId).reduce<string | null>((m, x) => (!m || x > m ? x : m), null)
}

export function packageBrief(p: PackageRecord): CustomerPackageBrief {
  return {
    id: p.id,
    code: p.code,
    packageName: p.packageName,
    serviceId: p.serviceId,
    serviceName: p.serviceName,
    totalSessions: p.totalSessions,
    remaining: p.totalSessions - p.usedSessions,
    expiryDate: p.expiryDate,
    status: p.status,
    sessionValue: p.sessionValue,
    minIntervalDays: p.minIntervalDays,
    lastUsedAt: lastUsedAt(p.id),
    purchasedAt: p.purchasedAt,
  }
}

export function customerPackages(customerId: string, serviceIds?: string[]): CustomerPackageBrief[] {
  return packagesDb
    .filter((p) => p.customerId === customerId && (!serviceIds?.length || serviceIds.includes(p.serviceId)))
    .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : a.code < b.code ? -1 : 1))
    .map(packageBrief)
}

export const staffName = (id: string): string => staffDb.get(id)?.fullName ?? ''

// ───────────────────────────── Việc nền (06 §3)

let maintaining = false

export function runMaintenance(): void {
  if (maintaining) return
  maintaining = true
  try {
    const day = today()
    const now = nowIso()
    const stale = appointmentsDb.filter((a) => a.date < day && (a.status === 'ChoXacNhan' || a.status === 'DaXacNhan'))
    const expired = packagesDb.filter((p) => p.status === 'DangDung' && p.expiryDate < day && p.totalSessions > p.usedSessions)
    if (stale.length === 0 && expired.length === 0) return
    mockDb.batch(() => {
      for (const a of stale)
        appointmentsDb.update(a.id, {
          status: 'KhongDen',
          noShowAt: new Date(vnStartOfDay(a.date) + (23 * 60 + 59) * 60_000).toISOString(),
          noShowByName: bookingRules.systemActorName,
        })
      for (const p of expired) packagesDb.update(p.id, { status: 'HetHan' })
    })
    void now
  } finally {
    maintaining = false
  }
}

export { vnLocal }
