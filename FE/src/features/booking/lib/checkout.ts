import type { CommissionType, CustomerPackageStatus, DiscountType, PaymentMethod } from '@/types/spa'
import { bookingRules, floor1000, formatVndPlain, sessionValueOf } from './rules'
import { addMonthsKey, ddmmyyyy, diffDaysKey } from './vn-time'

/**
 * Tính hóa đơn (07 §3.5, §3.6): trừ buổi, khoảng cách, giảm giá, tổng tiền, hoa hồng. Thuần; bản C#
 * `Domain/Entities/Booking/CheckoutMath.cs` giống hệt. Hộp thanh toán dùng để hiện số, mock dùng để tạo hóa đơn.
 */

export type CheckoutServiceLine = {
  lineId: string
  serviceId: string
  serviceName: string
  staffId: string
  staffName: string
  price: number
  duration: number
  commissionType: CommissionType
  commissionValue: number
  /** undefined = theo mặc định (tự trừ buổi khi có gói hợp lệ) */
  usePackage?: boolean
}

export type CheckoutPackage = {
  id: string
  code: string
  serviceId: string
  status: CustomerPackageStatus
  remaining: number
  expiryDate: string
  minIntervalDays: number
  lastUsedDate: string | null
  sessionValue: number
}

export type CheckoutSale = {
  templateId: string
  templateCode: string
  name: string
  serviceId: string
  serviceName: string
  sessions: number
  price: number
  validityMonths: number
  minIntervalDays: number
  commissionRate: number
  consultantId: string
  consultantName: string
}

export type CheckoutDiscount = { type: DiscountType; value: number; reason: string | null }

export type CheckoutInputData = {
  lines: CheckoutServiceLine[]
  packages: CheckoutPackage[]
  sales: CheckoutSale[]
  discount: CheckoutDiscount | null
  payDate: string
  discountLimitPercent: number
}

export type PackageRef = {
  packageId: string | null
  saleIndex: number | null
  code: string | null
  remainingAfter: number
  expiryDate: string
  minIntervalDays: number
}

export type CheckoutLineResult = {
  line: CheckoutServiceLine
  eligible: boolean
  usesPackage: boolean
  package: PackageRef | null
  amount: number
  basePrice: number
  intervalWarning: string | null
  packageNote: string | null
  commission: number
}

export type CheckoutSaleResult = {
  sale: CheckoutSale
  expiryDate: string
  sessionValue: number
  commission: number
  usedInInvoice: number
}

export type CheckoutResult = {
  lines: CheckoutLineResult[]
  sales: CheckoutSaleResult[]
  serviceTotal: number
  packageTotal: number
  discountAmount: number
  maxDiscount: number
  total: number
  /** Lỗi theo trường camelCase */
  errors: Record<string, string>
  requiresOverrideReason: boolean
}

type PoolItem = {
  packageId: string | null
  saleIndex: number | null
  code: string | null
  serviceId: string
  status: CustomerPackageStatus
  remaining: number
  expiry: string
  minIntervalDays: number
  lastUsed: string | null
  sessionValue: number
  order: number
  usedInInvoice: number
}

/** Hoa hồng dịch vụ một dòng (BR-23) */
export const serviceCommission = (line: Pick<CheckoutServiceLine, 'commissionType' | 'commissionValue'>, basePrice: number): number =>
  line.commissionType === 'PhanTram' ? floor1000((basePrice * line.commissionValue) / 100) : line.commissionValue

const byCode = (a: string | null, b: string | null) => {
  const x = a ?? '~'
  const y = b ?? '~'
  return x < y ? -1 : x > y ? 1 : 0
}

export function computeCheckout(input: CheckoutInputData): CheckoutResult {
  const errors: Record<string, string> = {}
  const sales = input.sales.map((s) => ({
    sale: s,
    expiry: addMonthsKey(input.payDate, s.validityMonths),
    sessionValue: sessionValueOf(s.price, s.sessions),
  }))
  const existing: PoolItem[] = input.packages.map((p) => ({
    packageId: p.id,
    saleIndex: null,
    code: p.code,
    serviceId: p.serviceId,
    status: p.status,
    remaining: p.remaining,
    expiry: p.expiryDate,
    minIntervalDays: p.minIntervalDays,
    lastUsed: p.lastUsedDate,
    sessionValue: p.sessionValue,
    order: 0,
    usedInInvoice: 0,
  }))
  const fresh: PoolItem[] = sales.map((s, i) => ({
    packageId: null,
    saleIndex: i,
    code: null,
    serviceId: s.sale.serviceId,
    status: 'DangDung',
    remaining: s.sale.sessions,
    expiry: s.expiry,
    minIntervalDays: s.sale.minIntervalDays,
    lastUsed: null,
    sessionValue: s.sessionValue,
    order: 1,
    usedInInvoice: 0,
  }))
  const pool = [...existing, ...fresh]

  const lines: CheckoutLineResult[] = input.lines.map((line, i) => {
    const candidate = pool
      .filter((p) => p.serviceId === line.serviceId && p.status === 'DangDung' && p.remaining >= 1 && input.payDate <= p.expiry)
      .sort((a, b) => (a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : 0) || a.order - b.order || byCode(a.code, b.code))[0]
    const eligible = !!candidate
    let use = line.usePackage ?? eligible
    if (use && !eligible) {
      errors[`lines[${i}].usePackage`] = `Dòng ${line.serviceName} không có gói hợp lệ để trừ buổi`
      use = false
    }

    let note: string | null = null
    if (!eligible) {
      const unusable = pool
        .filter((p) => p.serviceId === line.serviceId && p.packageId !== null)
        .sort((a, b) => (a.expiry < b.expiry ? 1 : a.expiry > b.expiry ? -1 : 0))[0]
      if (unusable) {
        note =
          unusable.status === 'DaDungHet' || unusable.remaining <= 0
            ? `Gói ${unusable.code} đã dùng hết`
            : unusable.status === 'HetHan' || input.payDate > unusable.expiry
              ? `Gói ${unusable.code} hết hạn ngày ${ddmmyyyy(unusable.expiry)}`
              : unusable.status === 'DaHuy'
                ? `Gói ${unusable.code} đã hủy`
                : null
      }
    }

    if (use && candidate) {
      let warning: string | null = null
      if (candidate.minIntervalDays > 0 && candidate.lastUsed) {
        const gap = diffDaysKey(candidate.lastUsed, input.payDate)
        if (gap < candidate.minIntervalDays)
          warning = `Buổi gần nhất cách ${gap} ngày, gói yêu cầu ${candidate.minIntervalDays} ngày`
      }
      candidate.remaining -= 1
      candidate.lastUsed = input.payDate
      if (candidate.saleIndex !== null) candidate.usedInInvoice += 1
      return {
        line,
        eligible: true,
        usesPackage: true,
        package: {
          packageId: candidate.packageId,
          saleIndex: candidate.saleIndex,
          code: candidate.code,
          remainingAfter: candidate.remaining,
          expiryDate: candidate.expiry,
          minIntervalDays: candidate.minIntervalDays,
        },
        amount: 0,
        basePrice: candidate.sessionValue,
        intervalWarning: warning,
        packageNote: null,
        commission: serviceCommission(line, candidate.sessionValue),
      }
    }
    return {
      line,
      eligible,
      usesPackage: false,
      package: null,
      amount: line.price,
      basePrice: line.price,
      intervalWarning: null,
      packageNote: note,
      commission: serviceCommission(line, line.price),
    }
  })

  const serviceTotal = lines.reduce((s, l) => s + l.amount, 0)
  const packageTotal = sales.reduce((s, x) => s + x.sale.price, 0)
  const maxDiscount = floor1000((serviceTotal * input.discountLimitPercent) / 100)
  let discountAmount = 0
  const discount = input.discount
  if (discount && discount.value > 0) {
    const roleLabel = input.discountLimitPercent >= bookingRules.managerDiscountLimit ? 'Chủ tiệm' : 'Lễ tân'
    const limitMessage = `${roleLabel} giảm tối đa ${input.discountLimitPercent}% (${formatVndPlain(maxDiscount)})`
    if (input.discountLimitPercent <= 0) errors['discount.value'] = 'Bạn không có quyền giảm giá'
    else if (discount.type === 'PhanTram') {
      if (!Number.isInteger(discount.value) || discount.value > 100)
        errors['discount.value'] = 'Phần trăm giảm là số nguyên từ 1 đến 100'
      else if (discount.value > input.discountLimitPercent) errors['discount.value'] = limitMessage
      else discountAmount = floor1000((serviceTotal * discount.value) / 100)
    } else {
      if (discount.value % 1000 !== 0) errors['discount.value'] = 'Số tiền giảm là bội số 1.000 ₫'
      else if (discount.value > maxDiscount) errors['discount.value'] = limitMessage
      else discountAmount = discount.value
    }
    if (!errors['discount.value'] && !discount.reason?.trim()) errors['discount.reason'] = 'Chọn lý do giảm giá'
  }

  const saleResults: CheckoutSaleResult[] = sales.map((s, i) => ({
    sale: s.sale,
    expiryDate: s.expiry,
    sessionValue: s.sessionValue,
    commission: floor1000((s.sale.price * s.sale.commissionRate) / 100),
    usedInInvoice: fresh[i].usedInInvoice,
  }))

  return {
    lines,
    sales: saleResults,
    serviceTotal,
    packageTotal,
    discountAmount,
    maxDiscount,
    total: serviceTotal + packageTotal - discountAmount,
    errors,
    requiresOverrideReason: lines.some((l) => l.usesPackage && l.intervalWarning !== null),
  }
}

/** Lỗi phương thức thanh toán (BR-17); tổng 0 ₫ không cần phương thức (BR-15) */
export function paymentErrors(
  total: number,
  method: PaymentMethod,
  cashReceived: number | null | undefined,
  cardAuthCode: string | null | undefined
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (total <= 0) return errors
  if (method === 'TienMat') {
    if (cashReceived === null || cashReceived === undefined || cashReceived < total)
      errors.cashReceived = `Tiền khách đưa chưa đủ, còn thiếu ${formatVndPlain(total - (cashReceived ?? 0))}`
  } else if (method === 'The') {
    if (!cardAuthCode || !/^\d{6}$/.test(cardAuthCode)) errors.cardAuthCode = 'Mã chuẩn chi gồm 6 chữ số'
  } else if (method !== 'ChuyenKhoan') errors.method = 'Chọn phương thức thanh toán'
  return errors
}
