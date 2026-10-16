import type { CommissionType, PaymentMethod } from '@/types/spa'
import { computeCheckout, type CheckoutDiscount, type CheckoutResult } from '../lib/checkout'
import { bookingRules } from '../lib/rules'
import { vnDateKey } from '../lib/vn-time'
import type { AppointmentRecord, CustomerRecord, InvoiceLineRecord, InvoiceRecord, LineRecord, PackageRecord, TemplateRecord } from './records'

/**
 * Tính và dựng hóa đơn (07 §3.6), giống `InvoiceBuilder.cs` của BE: hóa đơn, dòng (kèm hoa hồng), gói bán kèm; cập nhật
 * gói bị trừ, trạng thái lịch hẹn. Không ghi mock-db; seed-loader và handler thanh toán dùng chung.
 */

export type CheckoutDraft = {
  appointment: AppointmentRecord | null
  customer: CustomerRecord
  lines: { line: LineRecord; staffName: string; commissionType: CommissionType; commissionValue: number }[]
  usePackage?: Record<string, boolean>
  /** Gói của khách (bản sao sửa được) dùng được cho các dịch vụ của hóa đơn */
  packages: PackageRecord[]
  lastUsedDate: (packageId: string) => string | null
  sales: { template: TemplateRecord; serviceName: string; consultantId: string; consultantName: string }[]
  discount: CheckoutDiscount | null
  discountLimitPercent: number
  method: PaymentMethod
  cashReceived?: number | null
  cardAuthCode?: string | null
  overrideReason?: string | null
  now: string
  cashierName: string
  clientRequestId?: string | null
}

export type IdFactory = (kind: string, ...parts: (string | number)[]) => string

export function computeDraft(draft: CheckoutDraft): CheckoutResult {
  return computeCheckout({
    lines: draft.lines.map((l) => ({
      lineId: l.line.id,
      serviceId: l.line.serviceId,
      serviceName: l.line.serviceName,
      staffId: l.line.staffMemberId,
      staffName: l.staffName,
      price: l.line.price,
      duration: l.line.durationMinutes,
      commissionType: l.commissionType,
      commissionValue: l.commissionValue,
      usePackage: draft.usePackage?.[l.line.id],
    })),
    packages: draft.packages.map((p) => ({
      id: p.id,
      code: p.code,
      serviceId: p.serviceId,
      status: p.status,
      remaining: p.totalSessions - p.usedSessions,
      expiryDate: p.expiryDate,
      minIntervalDays: p.minIntervalDays,
      lastUsedDate: draft.lastUsedDate(p.id),
      sessionValue: p.sessionValue,
    })),
    sales: draft.sales.map((s) => ({
      templateId: s.template.id,
      templateCode: s.template.code,
      name: s.template.name,
      serviceId: s.template.serviceId,
      serviceName: s.serviceName,
      sessions: s.template.sessions,
      price: s.template.price,
      validityMonths: s.template.validityMonths,
      minIntervalDays: s.template.minIntervalDays,
      commissionRate: s.template.commissionRate,
      consultantId: s.consultantId,
      consultantName: s.consultantName,
    })),
    discount: draft.discount,
    payDate: vnDateKey(draft.now),
    discountLimitPercent: draft.discountLimitPercent,
  })
}

export type CheckoutOutcome = {
  invoice: InvoiceRecord
  newPackages: PackageRecord[]
  /** Gói đang có bị trừ buổi (đã sửa trên bản sao trong draft.packages) */
  touchedPackages: PackageRecord[]
}

export function applyDraft(draft: CheckoutDraft, result: CheckoutResult, nextCode: (prefix: string) => string, id: IdFactory): CheckoutOutcome {
  const invoiceCode = nextCode(bookingRules.invoicePrefix)
  const invoiceId = id('invoice', invoiceCode)
  const total = result.total
  const method: PaymentMethod = total <= 0 ? 'KhongThu' : draft.method
  const invoice: InvoiceRecord = {
    id: invoiceId,
    code: invoiceCode,
    appointmentId: draft.appointment?.id ?? null,
    customerId: draft.customer.id,
    paidAt: draft.now,
    cashierName: draft.cashierName,
    serviceTotal: result.serviceTotal,
    packageTotal: result.packageTotal,
    discountType: result.discountAmount > 0 ? (draft.discount?.type ?? null) : null,
    discountValue: result.discountAmount > 0 ? (draft.discount?.value ?? 0) : 0,
    discountAmount: result.discountAmount,
    discountReason: result.discountAmount > 0 ? (draft.discount?.reason?.trim() ?? null) : null,
    total,
    method,
    cashReceived: method === 'TienMat' ? (draft.cashReceived ?? null) : null,
    changeAmount: method === 'TienMat' && draft.cashReceived != null ? draft.cashReceived - total : null,
    cardAuthCode: method === 'The' ? (draft.cardAuthCode ?? null) : null,
    intervalOverrideReason: result.requiresOverrideReason ? (draft.overrideReason?.trim() ?? null) : null,
    status: 'DaThanhToan',
    cancelReason: null,
    cancelledAt: null,
    cancelledByName: null,
    clientRequestId: draft.clientRequestId?.trim() || null,
    createdAt: draft.now,
    lines: [],
  }

  // Gói bán kèm tạo trước để dòng dịch vụ trừ buổi được ngay (BR-21)
  const newPackages: PackageRecord[] = result.sales.map((s) => {
    const code = nextCode(bookingRules.packagePrefix)
    return {
      id: id('customer-package', code),
      code,
      customerId: draft.customer.id,
      packageTemplateId: s.sale.templateId,
      packageName: s.sale.name,
      serviceId: s.sale.serviceId,
      serviceName: s.sale.serviceName,
      totalSessions: s.sale.sessions,
      usedSessions: 0,
      price: s.sale.price,
      sessionValue: s.sessionValue,
      minIntervalDays: s.sale.minIntervalDays,
      commissionRate: s.sale.commissionRate,
      purchasedAt: draft.now,
      expiryDate: s.expiryDate,
      extendedDays: null,
      extendReason: null,
      extendedAt: null,
      extendedByName: null,
      consultantStaffId: s.sale.consultantId,
      consultantName: s.sale.consultantName,
      invoiceId,
      status: 'DangDung',
      createdAt: draft.now,
    }
  })

  const touched = new Map<string, PackageRecord>()
  let order = 0
  for (const line of result.lines) {
    order += 1
    const record: InvoiceLineRecord = {
      id: id('invoice-line', invoiceCode, order),
      kind: 'DichVu',
      sortOrder: order,
      appointmentLineId: line.line.lineId,
      serviceId: line.line.serviceId,
      packageTemplateId: null,
      customerPackageId: null,
      description: line.line.serviceName,
      staffMemberId: line.line.staffId,
      staffName: line.line.staffName,
      durationMinutes: line.line.duration,
      listPrice: line.line.price,
      usesPackage: line.usesPackage,
      amount: line.amount,
      basePrice: line.basePrice,
      packageCode: null,
      packageRemaining: null,
      packageExpiryDate: null,
      commissionRateType: line.line.commissionType,
      commissionRateValue: line.line.commissionValue,
      commissionAmount: line.commission,
      overrideReason: null,
    }
    if (line.usesPackage && line.package) {
      const pkg =
        line.package.packageId !== null
          ? draft.packages.find((p) => p.id === line.package!.packageId)!
          : newPackages[line.package.saleIndex!]
      pkg.usedSessions += 1
      if (pkg.totalSessions - pkg.usedSessions <= 0) pkg.status = 'DaDungHet'
      if (line.package.packageId !== null) touched.set(pkg.id, pkg)
      record.customerPackageId = pkg.id
      record.packageCode = pkg.code
      record.packageRemaining = pkg.totalSessions - pkg.usedSessions
      record.packageExpiryDate = pkg.expiryDate
      record.overrideReason = line.intervalWarning !== null ? (draft.overrideReason?.trim() ?? null) : null
    }
    invoice.lines.push(record)
  }

  result.sales.forEach((sale, i) => {
    order += 1
    const pkg = newPackages[i]
    invoice.lines.push({
      id: id('invoice-line', invoiceCode, order),
      kind: 'BanGoi',
      sortOrder: order,
      appointmentLineId: null,
      serviceId: sale.sale.serviceId,
      packageTemplateId: sale.sale.templateId,
      customerPackageId: pkg.id,
      description: sale.sale.name,
      staffMemberId: sale.sale.consultantId,
      staffName: sale.sale.consultantName,
      durationMinutes: 0,
      listPrice: sale.sale.price,
      usesPackage: false,
      amount: sale.sale.price,
      basePrice: sale.sale.price,
      packageCode: pkg.code,
      packageRemaining: pkg.totalSessions - pkg.usedSessions,
      packageExpiryDate: pkg.expiryDate,
      commissionRateType: 'PhanTram',
      commissionRateValue: sale.sale.commissionRate,
      commissionAmount: sale.commission,
      overrideReason: null,
    })
  })

  if (draft.appointment) {
    draft.appointment.status = 'HoanThanh'
    draft.appointment.completedAt = draft.now
  }

  return { invoice, newPackages, touchedPackages: [...touched.values()] }
}
