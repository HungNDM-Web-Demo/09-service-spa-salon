import { permissions } from '@/config/permissions'
import { usersDb } from '@/mock/system-data'
import type {
  AppointmentCardDto,
  AppointmentDetailDto,
  AppointmentLineDto,
  CommissionItemDto,
  CustomerPackageDto,
  DayOffDto,
  InvoiceBrief,
  InvoiceDto,
  PackageTemplateDto,
  ServiceDto,
  ServiceGroupDto,
  ServiceOption,
  StaffMemberDto,
} from '@/types/spa'
import { bookingRules, sessionValueOf } from '../lib/rules'
import { addDaysKey, monthKeyOf, monthLabel, vnDateKey } from '../lib/vn-time'
import { errorCodes } from './errors'
import type { AppointmentRecord, DayOffRecord, InvoiceRecord, PackageRecord, ServiceRecord, StaffRecord, TemplateRecord } from './records'
import {
  type Actor,
  appointmentsDb,
  can,
  customerDto,
  customerPackages,
  customersDb,
  groupsDb,
  invoicesDb,
  lastUsedAt,
  noShowCount90,
  nowIso,
  packagesDb,
  periodsDb,
  servicesDb,
  staffDb,
  templatesDb,
  today,
} from './store'

/** Bản ghi mock → DTO, cùng trường như BE trả (07 §5). */

export const activeTechnicians = (): StaffRecord[] => staffDb.filter((s) => s.isActive && s.kind === 'KyThuatVien')

export function technicianMap(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const s of activeTechnicians().sort((a, b) => a.sortOrder - b.sortOrder || (a.code < b.code ? -1 : 1)))
    for (const id of s.serviceIds) map.set(id, [...(map.get(id) ?? []), s.id])
  return map
}

export function groupDto(id: string): ServiceGroupDto {
  const g = groupsDb.get(id)!
  return { id: g.id, name: g.name, sortOrder: g.sortOrder, isVisible: g.isVisible, serviceCount: servicesDb.count((s) => s.groupId === id) }
}

export function onlineWarning(s: ServiceRecord, technicianCount: number): string | null {
  if (!s.allowOnline) return null
  if (!s.isVisible) return 'Dịch vụ đang ẩn nên chưa hiện trên trang đặt lịch'
  if (groupsDb.get(s.groupId)?.isVisible === false) return 'Nhóm dịch vụ đang ẩn nên dịch vụ chưa hiện trên trang đặt lịch'
  return technicianCount === 0 ? 'Dịch vụ chưa hiện trên trang đặt lịch vì chưa có kỹ thuật viên' : null
}

export function serviceDto(s: ServiceRecord, technicians = technicianMap()): ServiceDto {
  const count = technicians.get(s.id)?.length ?? 0
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    groupId: s.groupId,
    groupName: groupsDb.get(s.groupId)?.name ?? '',
    durationMinutes: s.durationMinutes,
    cleanupMinutes: s.cleanupMinutes,
    price: s.price,
    description: s.description,
    imageUrl: s.imageUrl,
    allowOnline: s.allowOnline,
    commissionType: s.commissionType,
    commissionValue: s.commissionValue,
    isVisible: s.isVisible,
    technicianCount: count,
    onlineWarning: onlineWarning(s, count),
    createdAt: s.createdAt,
  }
}

export const groupOrder = (groupId: string): number => groupsDb.get(groupId)?.sortOrder ?? 0

export function sortServices<T extends { groupId: string; code: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => groupOrder(a.groupId) - groupOrder(b.groupId) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
}

export function serviceOption(s: ServiceRecord, technicians: Map<string, string[]>): ServiceOption {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    groupId: s.groupId,
    groupName: groupsDb.get(s.groupId)?.name ?? '',
    durationMinutes: s.durationMinutes,
    cleanupMinutes: s.cleanupMinutes,
    price: s.price,
    technicianIds: technicians.get(s.id) ?? [],
  }
}

export function templateDto(t: TemplateRecord): PackageTemplateDto {
  const service = servicesDb.get(t.serviceId)
  const servicePrice = service?.price ?? 0
  const retail = servicePrice * t.sessions
  const saving = retail - t.price
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    serviceId: t.serviceId,
    serviceCode: service?.code ?? '',
    serviceName: service?.name ?? '',
    servicePrice,
    sessions: t.sessions,
    price: t.price,
    validityMonths: t.validityMonths,
    minIntervalDays: t.minIntervalDays,
    commissionRate: t.commissionRate,
    isActive: t.isActive,
    retailEquivalent: retail,
    savingAmount: saving,
    savingPercent: retail > 0 ? Math.round((saving * 1000) / retail) / 10 : 0,
    sessionValue: sessionValueOf(t.price, t.sessions),
    soldCount: packagesDb.count((p) => p.packageTemplateId === t.id),
  }
}

export function staffDto(s: StaffRecord): StaffMemberDto {
  return {
    id: s.id,
    code: s.code,
    fullName: s.fullName,
    phone: s.phone,
    kind: s.kind,
    color: s.color,
    specialty: s.specialty,
    userId: s.userId,
    username: s.userId ? (usersDb.get(s.userId)?.username ?? null) : null,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    serviceIds: s.serviceIds,
    shifts: s.kind === 'KyThuatVien' ? s.shifts : [],
  }
}

export function dayOffDto(d: DayOffRecord): DayOffDto {
  return {
    id: d.id,
    staffMemberId: d.staffMemberId,
    staffName: d.staffMemberId ? (staffDb.get(d.staffMemberId)?.fullName ?? null) : null,
    date: d.date,
    reason: d.reason,
  }
}

const isLate = (a: AppointmentRecord) =>
  a.date === today() &&
  (a.status === 'ChoXacNhan' || a.status === 'DaXacNhan') &&
  Date.now() >= new Date(a.startAt).getTime() + bookingRules.lateMinutes * 60_000

const pendingOverdue = (a: AppointmentRecord) =>
  a.status === 'ChoXacNhan' && Date.now() - new Date(a.createdAt).getTime() > bookingRules.pendingOverdueMinutes * 60_000

export function lineDto(l: AppointmentRecord['lines'][number]): AppointmentLineDto {
  const s = staffDb.get(l.staffMemberId)
  return {
    id: l.id,
    serviceId: l.serviceId,
    serviceName: l.serviceName,
    staffMemberId: l.staffMemberId,
    staffName: s?.fullName ?? '',
    staffColor: s?.color ?? '#64748B',
    startAt: l.startAt,
    endAt: l.endAt,
    durationMinutes: l.durationMinutes,
    cleanupMinutes: l.cleanupMinutes,
    price: l.price,
    sortOrder: l.sortOrder,
  }
}

export function cardDto(a: AppointmentRecord, flagged?: boolean): AppointmentCardDto {
  const c = customersDb.get(a.customerId)
  return {
    id: a.id,
    code: a.code,
    status: a.status,
    source: a.source,
    customerId: a.customerId,
    customerName: c?.fullName ?? '',
    customerPhone: c?.phone ?? '',
    isFlagged: flagged ?? noShowCount90(a.customerId) >= bookingRules.noShowFlagThreshold,
    note: a.note,
    createdAt: a.createdAt,
    checkedInAt: a.checkedInAt,
    startAt: a.startAt,
    endAt: a.endAt,
    isLate: isLate(a),
    pendingOverdue: pendingOverdue(a),
    lines: [...a.lines].sort((x, y) => x.sortOrder - y.sortOrder).map(lineDto),
  }
}

/** Lý do không hủy được hóa đơn (BR-25, BR-26); null là hủy được (chưa xét quyền) */
export function cancelBlock(i: InvoiceRecord): { code: string; message: string } | null {
  if (i.status !== 'DaThanhToan') return { code: errorCodes.trangThaiKhongHopLe, message: 'Hóa đơn đã hủy' }
  const month = monthKeyOf(vnDateKey(i.paidAt))
  const period = periodsDb.find((p) => p.month === month)
  if (period && period.status !== 'TamTinh')
    return { code: errorCodes.thangDaChot, message: `Tháng ${monthLabel(month)} đã chốt hoa hồng` }
  for (const sold of packagesDb.filter((p) => p.invoiceId === i.id)) {
    const usedElsewhere = invoicesDb.some(
      (x) => x.id !== i.id && x.status === 'DaThanhToan' && x.lines.some((l) => l.usesPackage && l.customerPackageId === sold.id)
    )
    if (usedElsewhere) return { code: errorCodes.goiDaDung, message: `Gói ${sold.code} đã được trừ buổi ở hóa đơn khác` }
  }
  return null
}

export function invoiceBrief(i: InvoiceRecord, actor: Actor): InvoiceBrief {
  const block = cancelBlock(i)
  const allowed = can(actor, permissions.invoices.cancel)
  return {
    id: i.id,
    code: i.code,
    paidAt: i.paidAt,
    total: i.total,
    method: i.method,
    status: i.status,
    canCancel: !block && allowed,
    cancelBlockedReason: i.status === 'DaThanhToan' ? (block?.message ?? (allowed ? null : 'Chỉ chủ tiệm hủy được hóa đơn')) : null,
  }
}

export function invoiceDto(i: InvoiceRecord, actor: Actor): InvoiceDto {
  const c = customersDb.get(i.customerId)
  const brief = invoiceBrief(i, actor)
  return {
    id: i.id,
    code: i.code,
    appointmentId: i.appointmentId,
    appointmentCode: i.appointmentId ? (appointmentsDb.get(i.appointmentId)?.code ?? null) : null,
    customer: { id: i.customerId, code: c?.code ?? '', fullName: c?.fullName ?? '', phone: c?.phone ?? '' },
    paidAt: i.paidAt,
    cashierName: i.cashierName,
    serviceTotal: i.serviceTotal,
    packageTotal: i.packageTotal,
    discountType: i.discountType,
    discountValue: i.discountValue,
    discountAmount: i.discountAmount,
    discountReason: i.discountReason,
    total: i.total,
    method: i.method,
    cashReceived: i.cashReceived,
    changeAmount: i.changeAmount,
    cardAuthCode: i.cardAuthCode,
    intervalOverrideReason: i.intervalOverrideReason,
    status: i.status,
    cancelReason: i.cancelReason,
    cancelledAt: i.cancelledAt,
    cancelledByName: i.cancelledByName,
    canCancel: brief.canCancel,
    cancelBlockedReason: brief.cancelBlockedReason,
    lines: [...i.lines]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({
        id: l.id,
        kind: l.kind,
        description: l.description,
        staffName: l.staffName,
        durationMinutes: l.durationMinutes,
        listPrice: l.listPrice,
        usesPackage: l.usesPackage,
        amount: l.amount,
        basePrice: l.basePrice,
        packageCode: l.packageCode,
        packageRemaining: l.packageRemaining,
        packageExpiryDate: l.packageExpiryDate,
        commissionAmount: i.status === 'DaThanhToan' ? l.commissionAmount : 0,
      })),
  }
}

export function detailDto(a: AppointmentRecord, actor: Actor): AppointmentDetailDto {
  const customer = customerDto(customersDb.get(a.customerId)!)
  const card = cardDto(a, customer.isFlagged)
  const canUpdate = can(actor, permissions.appointments.update)
  const editable = a.status === 'ChoXacNhan' || a.status === 'DaXacNhan'
  return {
    ...card,
    date: a.date,
    customer,
    packages: customerPackages(a.customerId).filter((p) => p.status === 'DangDung'),
    createdByName: a.createdByName,
    confirmedAt: a.confirmedAt,
    confirmedByName: a.confirmedByName,
    checkedInByName: a.checkedInByName,
    cancelReason: a.cancelReason,
    cancelNote: a.cancelNote,
    cancelledAt: a.cancelledAt,
    cancelledByName: a.cancelledByName,
    noShowAt: a.noShowAt,
    noShowByName: a.noShowByName,
    completedAt: a.completedAt,
    messages: [...a.messages].sort((x, y) => (x.sentAt < y.sentAt ? -1 : 1)),
    invoices: invoicesDb
      .filter((i) => i.appointmentId === a.id)
      .sort((x, y) => (x.paidAt < y.paidAt ? 1 : -1))
      .map((i) => invoiceBrief(i, actor)),
    actions: {
      canEdit: canUpdate && (editable || a.status === 'DangPhucVu'),
      canConfirm: canUpdate && a.status === 'ChoXacNhan',
      canReject: canUpdate && a.status === 'ChoXacNhan',
      canCancel: can(actor, permissions.appointments.cancel) && editable,
      canCheckIn: canUpdate && a.date === today() && editable,
      canNoShow: canUpdate && isLate(a),
      canCheckout: can(actor, permissions.invoices.create) && a.status === 'DangPhucVu',
    },
  }
}

export function packageDto(p: PackageRecord, actor: Actor): CustomerPackageDto {
  const c = customersDb.get(p.customerId)
  const day = today()
  return {
    id: p.id,
    code: p.code,
    packageName: p.packageName,
    serviceId: p.serviceId,
    serviceName: p.serviceName,
    totalSessions: p.totalSessions,
    usedSessions: p.usedSessions,
    remaining: p.totalSessions - p.usedSessions,
    expiryDate: p.expiryDate,
    status: p.status,
    sessionValue: p.sessionValue,
    minIntervalDays: p.minIntervalDays,
    lastUsedAt: lastUsedAt(p.id),
    purchasedAt: p.purchasedAt,
    customerId: p.customerId,
    customerCode: c?.code ?? '',
    customerName: c?.fullName ?? '',
    customerPhone: c?.phone ?? '',
    packageTemplateId: p.packageTemplateId,
    price: p.price,
    extendedDays: p.extendedDays,
    extendReason: p.extendReason,
    consultantName: p.consultantName,
    invoiceId: p.invoiceId,
    invoiceCode: invoicesDb.get(p.invoiceId)?.code ?? '',
    expiringSoon: p.status === 'DangDung' && p.expiryDate >= day && p.expiryDate <= addDaysKey(day, bookingRules.expiringSoonDays),
    canExtend:
      can(actor, permissions.customerPackages.extend) && p.extendedDays === null && (p.status === 'DangDung' || p.status === 'HetHan'),
  }
}

/** Khoản hoa hồng suy từ dòng hóa đơn đã thanh toán (thay bảng Hr_Commissions) */
export function commissionItems(filter: (i: InvoiceRecord) => boolean): (CommissionItemDto & { staffMemberId: string; month: number })[] {
  return invoicesDb
    .filter((i) => i.status === 'DaThanhToan' && filter(i))
    .flatMap((i) => {
      const customerName = customersDb.get(i.customerId)?.fullName ?? ''
      const month = monthKeyOf(vnDateKey(i.paidAt))
      return i.lines.map((l) => ({
        id: l.id,
        staffMemberId: l.staffMemberId,
        month,
        earnedAt: i.paidAt,
        invoiceId: i.id,
        invoiceCode: i.code,
        appointmentId: i.appointmentId,
        customerName,
        kind: l.kind,
        description: l.description,
        baseAmount: l.basePrice,
        rateType: l.commissionRateType,
        rateValue: l.commissionRateValue,
        amount: l.commissionAmount,
      }))
    })
}

export const templateOf = (id: string) => templatesDb.get(id)
export { nowIso }
