import type { StatusTone } from '@/components/shared/StatusBadge'
import type { Option } from '@/types/api'
import type {
  AppointmentSource,
  AppointmentStatus,
  CancelReason,
  CommissionKind,
  CommissionPeriodStatus,
  CommissionType,
  CustomerPackageStatus,
  DiscountType,
  Gender,
  InvoiceStatus,
  MessageChannel,
  MessageKind,
  PaymentMethod,
  ShiftType,
  StaffKind,
} from '@/types/spa'
import { cancelReasonLabel } from './rules'

/** Nhãn tiếng Việt và tông màu cho enum nghiệp vụ Spa (07 §2.1). Màu luôn đi kèm chữ. */

type Labeled = { label: string; tone: StatusTone }

export const appointmentStatusLabels: Record<AppointmentStatus, Labeled> = {
  ChoXacNhan: { label: 'Chờ xác nhận', tone: 'warning' },
  DaXacNhan: { label: 'Đã xác nhận', tone: 'info' },
  DangPhucVu: { label: 'Đang phục vụ', tone: 'success' },
  HoanThanh: { label: 'Hoàn thành', tone: 'neutral' },
  DaHuy: { label: 'Đã hủy', tone: 'danger' },
  KhongDen: { label: 'Không đến', tone: 'danger' },
}

export const sourceLabels: Record<AppointmentSource, string> = {
  Online: 'Đặt online',
  DienThoai: 'Điện thoại',
  VangLai: 'Khách vãng lai',
  ZaloFacebook: 'Zalo/Facebook',
}

/** Nguồn lễ tân chọn khi tạo lịch (Online chỉ do trang đặt lịch tạo) */
export const counterSourceOptions: Option<AppointmentSource>[] = (['DienThoai', 'VangLai', 'ZaloFacebook'] as const).map((value) => ({
  value,
  label: sourceLabels[value],
}))

/** Lý do hủy theo thao tác (UC-05: hủy; 3a: từ chối lịch online) */
export const cancelReasonOptions: Option<CancelReason>[] = (['KhachBaoHuy', 'TiemDoiLich', 'Khac'] as const).map((value) => ({
  value,
  label: cancelReasonLabel(value),
}))
export const rejectReasonOptions: Option<CancelReason>[] = (['HetCho', 'KhongLienLacDuoc', 'Khac'] as const).map((value) => ({
  value,
  label: cancelReasonLabel(value),
}))

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  TienMat: 'Tiền mặt',
  ChuyenKhoan: 'Chuyển khoản',
  The: 'Thẻ',
  KhongThu: 'Không thu (trừ buổi)',
}

export const invoiceStatusLabels: Record<InvoiceStatus, Labeled> = {
  DaThanhToan: { label: 'Đã thanh toán', tone: 'success' },
  DaHuy: { label: 'Đã hủy', tone: 'danger' },
}

export const packageStatusLabels: Record<CustomerPackageStatus, Labeled> = {
  DangDung: { label: 'Đang dùng', tone: 'success' },
  DaDungHet: { label: 'Đã dùng hết', tone: 'neutral' },
  HetHan: { label: 'Hết hạn', tone: 'warning' },
  DaHuy: { label: 'Đã hủy', tone: 'danger' },
}

export const periodStatusLabels: Record<CommissionPeriodStatus, Labeled> = {
  TamTinh: { label: 'Tạm tính', tone: 'warning' },
  DaChot: { label: 'Đã chốt', tone: 'info' },
  DaChiTra: { label: 'Đã chi trả', tone: 'success' },
}

export const commissionKindLabels: Record<CommissionKind, string> = { DichVu: 'Dịch vụ', BanGoi: 'Bán gói' }

export const commissionTypeLabels: Record<CommissionType, string> = { PhanTram: 'Phần trăm giá', CoDinh: 'Cố định mỗi lượt' }

export const shiftLabels: Record<ShiftType, string> = { Sang: 'Sáng', Chieu: 'Chiều', CaNgay: 'Cả ngày', Nghi: 'Nghỉ' }
export const shiftOptions: Option<ShiftType>[] = (['Sang', 'Chieu', 'CaNgay', 'Nghi'] as const).map((value) => ({
  value,
  label: shiftLabels[value],
}))

export const staffKindLabels: Record<StaffKind, string> = { KyThuatVien: 'Kỹ thuật viên', LeTan: 'Lễ tân' }

export const genderLabels: Record<Gender, string> = { Nu: 'Nữ', Nam: 'Nam', Khac: 'Khác' }

export const discountTypeLabels: Record<DiscountType, string> = { PhanTram: '%', SoTien: '₫' }

/** Lý do giảm giá gợi ý (BR-16); lễ tân có thể nhập lý do khác */
export const discountReasons = ['Khách quen', 'Sinh nhật khách', 'Khuyến mãi tháng', 'Bù trải nghiệm chưa tốt', 'Khác']

export const messageKindLabels: Record<MessageKind, string> = { XacNhan: 'Xác nhận', DoiLich: 'Đổi lịch', Huy: 'Hủy', Nhac: 'Nhắc lịch' }
export const messageChannelLabels: Record<MessageChannel, string> = { Zalo: 'Zalo', Sms: 'SMS' }

/** "Nữ", "Không rõ" */
export const genderText = (g: Gender | null | undefined): string => (g ? genderLabels[g] : 'Không rõ')

/** "12%" hoặc "30.000 ₫/lượt" */
export function commissionText(type: CommissionType, value: number): string {
  return type === 'PhanTram' ? `${value}%` : `${value.toLocaleString('vi-VN')} ₫/lượt`
}
