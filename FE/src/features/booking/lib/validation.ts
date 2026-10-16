import type {
  CancelAppointmentInput,
  CreateAppointmentInput,
  SavePackageTemplateInput,
  SaveServiceInput,
  SaveStaffMemberInput,
} from '@/types/spa'
import { bookingRules, digitsOnly, PHONE_PATTERN } from './rules'

/**
 * Kiểm tra dữ liệu gửi lên, cùng câu báo với validator FluentValidation của BE (BookingValidators.cs). Mock gọi trước khi
 * ghi; form dùng schema Zod riêng nhưng câu báo giống.
 */

type Errors = Record<string, string>

const CODE = /^[A-Z0-9]{2,10}$/

export function catalogCodeError(value: string | undefined, label: string): string | null {
  if (!value?.trim()) return `Nhập ${label}`
  if (!CODE.test(value.trim())) return `${label.charAt(0).toUpperCase()}${label.slice(1)} gồm 2–10 chữ in hoa không dấu hoặc số`
  return null
}

export function phoneError(value: string | undefined | null): string | null {
  if (!value?.trim()) return 'Nhập số điện thoại'
  return PHONE_PATTERN.test(digitsOnly(value)) ? null : 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0'
}

export function validateService(input: SaveServiceInput): Errors {
  const e: Errors = {}
  const code = catalogCodeError(input.code, 'mã dịch vụ')
  if (code) e.code = code
  if (!input.name?.trim()) e.name = 'Nhập tên dịch vụ'
  if (!input.groupId) e.groupId = 'Chọn nhóm dịch vụ'
  if (input.durationMinutes % 15 !== 0) e.durationMinutes = 'Thời lượng là bội số 15 phút'
  else if (input.durationMinutes < bookingRules.durationMin || input.durationMinutes > bookingRules.durationMax)
    e.durationMinutes = 'Thời lượng từ 15 đến 240 phút'
  if (input.cleanupMinutes % 5 !== 0) e.cleanupMinutes = 'Thời gian dọn là bội số 5 phút'
  else if (input.cleanupMinutes < 0 || input.cleanupMinutes > bookingRules.cleanupMax)
    e.cleanupMinutes = 'Thời gian dọn từ 0 đến 30 phút'
  if (input.price < 0) e.price = 'Giá không được âm'
  else if (input.price % 1000 !== 0) e.price = 'Giá là bội số 1.000 ₫'
  if (input.commissionType === 'PhanTram') {
    if (input.commissionValue < 0 || input.commissionValue > bookingRules.maxCommissionPercent)
      e.commissionValue = 'Hoa hồng phần trăm từ 0 đến 50%'
  } else if (input.commissionValue < 0) e.commissionValue = 'Hoa hồng không được âm'
  else if (input.commissionValue % 1000 !== 0) e.commissionValue = 'Hoa hồng cố định là bội số 1.000 ₫'
  return e
}

export function validateTemplate(input: SavePackageTemplateInput): Errors {
  const e: Errors = {}
  const code = catalogCodeError(input.code, 'mã gói')
  if (code) e.code = code
  if (!input.name?.trim()) e.name = 'Nhập tên gói'
  if (!input.serviceId) e.serviceId = 'Chọn dịch vụ áp dụng'
  if (input.sessions < 2 || input.sessions > 50) e.sessions = 'Số buổi từ 2 đến 50'
  if (!(input.price > 0)) e.price = 'Nhập giá gói'
  else if (input.price % 1000 !== 0) e.price = 'Giá gói là bội số 1.000 ₫'
  if (input.validityMonths < 1 || input.validityMonths > 36) e.validityMonths = 'Hạn dùng từ 1 đến 36 tháng'
  if (input.minIntervalDays < 0 || input.minIntervalDays > 90) e.minIntervalDays = 'Khoảng cách tối thiểu từ 0 đến 90 ngày'
  if (input.commissionRate < 0 || input.commissionRate > 50) e.commissionRate = 'Tỉ lệ hoa hồng bán gói từ 0 đến 50%'
  return e
}

export function validateStaff(input: SaveStaffMemberInput): Errors {
  const e: Errors = {}
  const code = catalogCodeError(input.code, 'mã nhân viên')
  if (code) e.code = code
  if (!input.fullName?.trim()) e.fullName = 'Nhập họ tên'
  const phone = phoneError(input.phone)
  if (phone) e.phone = phone
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.color ?? '')) e.color = 'Chọn màu hiển thị'
  if (input.shifts && input.shifts.length !== 7) e.shifts = 'Lịch tuần gồm 7 ngày'
  return e
}

export function validateCreateAppointment(input: CreateAppointmentInput): Errors {
  const e: Errors = {}
  if (!input.lines?.length) e.lines = 'Thêm ít nhất một dịch vụ'
  else if (input.lines.length > bookingRules.maxLines) e.lines = 'Lịch hẹn tối đa 5 dịch vụ'
  input.lines?.forEach((l, i) => {
    if (!l.serviceId) e[`lines[${i}].serviceId`] = 'Chọn dịch vụ'
    if (!l.staffMemberId) e[`lines[${i}].staffMemberId`] = 'Chọn kỹ thuật viên'
  })
  if (!input.customerId) {
    if (!input.newCustomer) e.newCustomer = 'Nhập số điện thoại khách'
    else {
      const phone = phoneError(input.newCustomer.phone)
      if (phone) e['newCustomer.phone'] = phone
      if (!input.newCustomer.fullName?.trim()) e['newCustomer.fullName'] = 'Nhập tên khách'
    }
  }
  if ((input.note ?? '').length > 500) e.note = 'Ghi chú tối đa 500 ký tự'
  return e
}

export function validateCancel(input: CancelAppointmentInput): Errors {
  const e: Errors = {}
  if (!input.reason) e.reason = 'Chọn lý do'
  if (input.reason === 'Khac' && !input.note?.trim()) e.note = 'Ghi rõ lý do'
  return e
}
