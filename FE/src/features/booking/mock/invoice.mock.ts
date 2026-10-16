import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { newId, paginate, search as searchItems, sortItems } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  CheckoutInput,
  CustomerPackageDetailDto,
  CustomerPackageDto,
  CustomerPackageQuery,
  InvoiceDto,
  InvoiceQuery,
  PackageSaleInput,
} from '@/types/spa'
import { paymentErrors } from '../lib/checkout'
import { bookingRules, digitsOnly, discountLimitOf, formatVndPlain } from '../lib/rules'
import { addDaysKey, monthKeyOf, vnDateKey } from '../lib/vn-time'
import { conflictError, errorCodes, fieldErrors, invalidState, notFoundError } from './errors'
import { applyDraft, computeDraft, type CheckoutDraft } from './invoice-builder'
import { cancelBlock, invoiceDto, packageDto } from './mappers'
import type { InvoiceRecord, PackageRecord } from './records'
import {
  actor,
  appointmentsDb,
  can,
  customersDb,
  ensureFresh,
  invoicesDb,
  lastUsedAt,
  nextDocCode,
  nowIso,
  packagesDb,
  periodsDb,
  servicesDb,
  staffDb,
  staffName,
  templatesDb,
  today,
} from './store'

/** Handler mock thanh toán, bán gói, hóa đơn, gói của khách (07 §3.6, §3.7, §4.6, §4.7), giống InvoiceService của BE. */

function findByRequestId(clientRequestId?: string | null): InvoiceRecord | undefined {
  const key = clientRequestId?.trim()
  return key ? invoicesDb.find((i) => i.clientRequestId === key) : undefined
}

function resolveSales(items: { packageTemplateId: string; consultantStaffId?: string | null }[], prefix: string | null) {
  const errors: Record<string, string> = {}
  const sales = items.flatMap((s, i) => {
    const field = prefix ? `${prefix}[${i}].` : ''
    const template = templatesDb.get(s.packageTemplateId)
    if (!template || !template.isActive) {
      errors[`${field}packageTemplateId`] = template ? `Gói ${template.name} đã ngừng bán` : 'Chọn gói'
      return []
    }
    const consultant = s.consultantStaffId ? staffDb.get(s.consultantStaffId) : undefined
    if (!consultant || !consultant.isActive) {
      errors[`${field}consultantStaffId`] = 'Chọn người tư vấn'
      return []
    }
    return [{ template, serviceName: servicesDb.get(template.serviceId)?.name ?? '', consultantId: consultant.id, consultantName: consultant.fullName }]
  })
  if (Object.keys(errors).length) throw fieldErrors(errors)
  return sales
}

/** Tính, kiểm tra, dựng và lưu hóa đơn (07 §3.6 bước 1–8) */
function save(draft: CheckoutDraft, expectedTotal: number): InvoiceRecord {
  const result = computeDraft(draft)
  const errors: Record<string, string> = { ...result.errors }
  if (result.requiresOverrideReason && !draft.overrideReason?.trim()) {
    const warning = result.lines.find((l) => l.usesPackage && l.intervalWarning)!.intervalWarning
    errors.intervalOverrideReason = `${warning}. Nhập lý do để trừ buổi`
  }
  Object.assign(errors, paymentErrors(result.total, draft.method, draft.cashReceived, draft.cardAuthCode))
  if (Object.keys(errors).length) throw fieldErrors(errors)
  if (expectedTotal !== result.total)
    throw conflictError(errorCodes.tongTienDaDoi, `Tổng tiền đã thay đổi thành ${formatVndPlain(result.total)}, vui lòng kiểm tra lại.`, undefined, {
      serverTotal: result.total,
    })

  const payDate = vnDateKey(draft.now)
  const reserved = new Map<string, number>()
  const outcome = applyDraft(draft, result, (prefix) => nextDocCode(prefix, payDate, reserved), () => newId())
  mockDb.batch(() => {
    invoicesDb.insert(outcome.invoice)
    if (outcome.newPackages.length) packagesDb.insertMany(outcome.newPackages)
    for (const p of outcome.touchedPackages) packagesDb.update(p.id, { usedSessions: p.usedSessions, status: p.status })
    if (draft.appointment) appointmentsDb.update(draft.appointment.id, { status: draft.appointment.status, completedAt: draft.appointment.completedAt })
    const month = monthKeyOf(payDate)
    if (!periodsDb.some((p) => p.month === month))
      periodsDb.insert({
        id: newId(),
        code: `${bookingRules.commissionPrefix}${String(month % 10000).padStart(4, '0')}`,
        month,
        status: 'TamTinh',
        closedAt: null,
        closedByName: null,
        paidAt: null,
        paidByName: null,
      })
  })
  return outcome.invoice
}

const lastUsedDate = (id: string) => {
  const at = lastUsedAt(id)
  return at ? vnDateKey(at) : null
}

export const invoiceMock = {
  async checkout(input: CheckoutInput): Promise<InvoiceDto> {
    await mockDelay()
    requirePermission(permissions.invoices.create)
    ensureFresh()
    const repeat = findByRequestId(input.clientRequestId)
    if (repeat) return invoiceDto(repeat, actor())
    const appointment = appointmentsDb.get(input.appointmentId)
    if (!appointment) throw notFoundError('Không tìm thấy lịch hẹn.')
    if (appointment.status !== 'DangPhucVu')
      throw invalidState(appointment.status === 'HoanThanh' ? 'Lịch hẹn đã thanh toán.' : 'Chỉ thanh toán lịch đang phục vụ (đã check-in).')
    const customer = customersDb.get(appointment.customerId)!
    const me = actor()
    const sales = resolveSales(input.sellPackages ?? [], 'sellPackages')
    const relevant = new Set([...appointment.lines.map((l) => l.serviceId), ...sales.map((s) => s.template.serviceId)])
    const draft: CheckoutDraft = {
      appointment: { ...appointment },
      customer,
      lines: [...appointment.lines]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((line) => {
          const s = servicesDb.get(line.serviceId)
          return {
            line,
            staffName: staffName(line.staffMemberId),
            commissionType: s?.commissionType ?? 'PhanTram',
            commissionValue: s?.commissionValue ?? 0,
          }
        }),
      usePackage: Object.fromEntries((input.lines ?? []).map((l) => [l.appointmentLineId, l.usePackage])),
      packages: packagesDb.filter((p) => p.customerId === customer.id && relevant.has(p.serviceId)).map((p) => ({ ...p })),
      lastUsedDate,
      sales,
      discount: input.discount && input.discount.value > 0 ? { ...input.discount } : null,
      discountLimitPercent: discountLimitOf(can(me, permissions.invoices.discount), can(me, permissions.invoices.discountHigh)),
      method: input.method,
      cashReceived: input.cashReceived ?? null,
      cardAuthCode: input.cardAuthCode?.trim() ?? null,
      overrideReason: input.intervalOverrideReason ?? null,
      now: nowIso(),
      cashierName: me.fullName,
      clientRequestId: input.clientRequestId,
    }
    return invoiceDto(save(draft, input.expectedTotal), me)
  },

  async sellPackage(input: PackageSaleInput): Promise<InvoiceDto> {
    await mockDelay()
    requirePermission(permissions.customerPackages.sell)
    ensureFresh()
    const repeat = findByRequestId(input.clientRequestId)
    if (repeat) return invoiceDto(repeat, actor())
    const errors: Record<string, string> = {}
    if (!input.customerId) errors.customerId = 'Chọn khách'
    if (!input.packageTemplateId) errors.packageTemplateId = 'Chọn gói'
    if (!input.consultantStaffId) errors.consultantStaffId = 'Chọn người tư vấn'
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const customer = customersDb.get(input.customerId!)
    if (!customer) throw fieldErrors({ customerId: 'Chọn khách' })
    const me = actor()
    const sales = resolveSales([{ packageTemplateId: input.packageTemplateId, consultantStaffId: input.consultantStaffId }], null)
    const draft: CheckoutDraft = {
      appointment: null,
      customer,
      lines: [],
      packages: [],
      lastUsedDate: () => null,
      sales,
      discount: null,
      discountLimitPercent: 0,
      method: input.method,
      cashReceived: input.cashReceived ?? null,
      cardAuthCode: input.cardAuthCode?.trim() ?? null,
      now: nowIso(),
      cashierName: me.fullName,
      clientRequestId: input.clientRequestId,
    }
    return invoiceDto(save(draft, input.expectedTotal), me)
  },

  async get(id: string): Promise<InvoiceDto> {
    await mockDelay()
    requirePermission(permissions.invoices.create, permissions.customers.view, permissions.customerPackages.view)
    ensureFresh()
    const invoice = invoicesDb.get(id)
    if (!invoice) throw notFoundError('Không tìm thấy hóa đơn.')
    return invoiceDto(invoice, actor())
  },

  async getList(query: InvoiceQuery): Promise<PaginatedResult<InvoiceDto>> {
    await mockDelay()
    requirePermission(permissions.invoices.create, permissions.customers.view)
    ensureFresh()
    const me = actor()
    const list = invoicesDb.filter(
      (i) =>
        (!query.customerId || i.customerId === query.customerId) &&
        (!query.from || vnDateKey(i.paidAt) >= query.from) &&
        (!query.to || vnDateKey(i.paidAt) <= query.to)
    )
    const sorted = sortItems(list, query.sortBy || 'paidAt', query.sortDir || 'desc')
    const page = paginate(sorted, query)
    return { ...page, items: page.items.map((i) => invoiceDto(i, me)) }
  },

  async cancel(id: string, reason: string): Promise<InvoiceDto> {
    await mockDelay()
    requirePermission(permissions.invoices.cancel)
    ensureFresh()
    if (!reason?.trim()) throw fieldErrors({ reason: 'Nhập lý do hủy hóa đơn' })
    const invoice = invoicesDb.get(id)
    if (!invoice) throw notFoundError('Không tìm thấy hóa đơn.')
    const block = cancelBlock(invoice)
    if (block) throw conflictError(block.code, block.message)
    const me = actor()
    const now = nowIso()
    const day = today()
    mockDb.batch(() => {
      // Trả lại buổi đã trừ (BR-26)
      for (const line of invoice.lines.filter((l) => l.usesPackage && l.customerPackageId)) {
        packagesDb.update(line.customerPackageId!, (p) => {
          const used = Math.max(0, p.usedSessions - 1)
          const status =
            p.status === 'DaDungHet' && p.totalSessions - used > 0 ? (p.expiryDate < day ? 'HetHan' : 'DangDung') : p.status
          return { ...p, usedSessions: used, status }
        })
      }
      for (const sold of packagesDb.filter((p) => p.invoiceId === id)) packagesDb.update(sold.id, { status: 'DaHuy' })
      if (invoice.appointmentId) appointmentsDb.update(invoice.appointmentId, { status: 'DangPhucVu', completedAt: null })
      invoicesDb.update(id, { status: 'DaHuy', cancelReason: reason.trim(), cancelledAt: now, cancelledByName: me.fullName })
    })
    return invoiceDto(invoicesDb.get(id)!, me)
  },

  // ── Gói của khách
  async getPackages(query: CustomerPackageQuery): Promise<PaginatedResult<CustomerPackageDto>> {
    await mockDelay()
    requirePermission(permissions.customerPackages.view)
    ensureFresh()
    const me = actor()
    const day = today()
    const soon = addDaysKey(day, bookingRules.expiringSoonDays)
    let list = packagesDb.filter(
      (p) => (!query.customerId || p.customerId === query.customerId) && (!query.status || p.status === query.status)
    )
    if (query.filter === 'expiringSoon') list = list.filter((p) => p.status === 'DangDung' && p.expiryDate >= day && p.expiryDate <= soon)
    if (query.filter === 'lastSession') list = list.filter((p) => p.status === 'DangDung' && p.totalSessions - p.usedSessions === 1)
    const dtos = list.map((p) => packageDto(p, me))
    const digits = digitsOnly(query.search ?? '')
    const keyword = /^\d{3,}$/.test(digits) ? digits : query.search
    const found = searchItems(dtos, keyword, ['code', 'packageName', 'customerName', 'customerPhone'])
    return paginate(sortItems(found, query.sortBy || 'purchasedAt', query.sortDir || 'desc'), query)
  },

  async getPackage(id: string): Promise<CustomerPackageDetailDto> {
    await mockDelay()
    requirePermission(permissions.customerPackages.view)
    ensureFresh()
    const p = packagesDb.get(id)
    if (!p) throw notFoundError('Không tìm thấy gói của khách.')
    return packageDetail(p)
  },

  async extendPackage(id: string, days: number, reason: string): Promise<CustomerPackageDetailDto> {
    await mockDelay()
    requirePermission(permissions.customerPackages.extend)
    ensureFresh()
    const errors: Record<string, string> = {}
    if (!(days >= 1 && days <= bookingRules.maxExtendDays)) errors.days = 'Gia hạn từ 1 đến 60 ngày'
    if (!reason?.trim()) errors.reason = 'Nhập lý do gia hạn'
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const p = packagesDb.get(id)
    if (!p) throw notFoundError('Không tìm thấy gói của khách.')
    if (p.extendedDays !== null) throw invalidState('Gói đã gia hạn một lần, không gia hạn thêm được.')
    if (p.status !== 'DangDung' && p.status !== 'HetHan') throw invalidState('Chỉ gia hạn gói đang dùng hoặc đã hết hạn còn buổi.')
    const expiryDate = addDaysKey(p.expiryDate, days)
    const status =
      p.status === 'HetHan' && p.totalSessions - p.usedSessions > 0 && expiryDate >= today() ? 'DangDung' : p.status
    const next = packagesDb.update(id, {
      expiryDate,
      extendedDays: days,
      extendReason: reason.trim(),
      extendedAt: nowIso(),
      extendedByName: actor().fullName,
      status,
    })!
    return packageDetail(next)
  },
}

function packageDetail(p: PackageRecord): CustomerPackageDetailDto {
  const usages = invoicesDb
    .all()
    .flatMap((i) =>
      i.lines
        .filter((l) => l.usesPackage && l.customerPackageId === p.id)
        .map((l) => ({
          id: l.id,
          usedAt: i.paidAt,
          appointmentId: i.appointmentId,
          appointmentCode: i.appointmentId ? (appointmentsDb.get(i.appointmentId)?.code ?? null) : null,
          invoiceCode: i.code,
          staffName: l.staffName,
          overrideReason: l.overrideReason,
          refunded: i.status === 'DaHuy',
        }))
    )
    .sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1))
  return { ...packageDto(p, actor()), usages }
}
