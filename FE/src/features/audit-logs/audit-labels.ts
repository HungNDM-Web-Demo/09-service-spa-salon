import type { StatusTone } from '@/components/shared/StatusBadge'
import type { AuditAction } from './types/audit-log.types'

/** Nhãn hiển thị cho nhật ký. Dự án thêm tên entity và tên cột nghiệp vụ của mình vào đây. */

export const auditActionLabels: Record<AuditAction, { label: string; tone: StatusTone }> = {
  Create: { label: 'Thêm', tone: 'success' },
  Update: { label: 'Sửa', tone: 'info' },
  Delete: { label: 'Xóa', tone: 'danger' },
  Login: { label: 'Đăng nhập', tone: 'neutral' },
}

/** Tên entity (BE) → tên tiếng Việt; cũng là danh sách cho bộ lọc "Đối tượng". */
export const auditEntityLabels: Record<string, string> = {
  User: 'Tài khoản',
  Role: 'Vai trò',
  Setting: 'Cài đặt',
  ServiceGroup: 'Nhóm dịch vụ',
  Service: 'Dịch vụ',
  PackageTemplate: 'Mẫu gói liệu trình',
  StaffMember: 'Nhân viên',
  DayOff: 'Ngày nghỉ',
  BusinessHours: 'Giờ mở cửa',
  Customer: 'Khách hàng',
}

/** Tên cột (camelCase) → nhãn tiếng Việt trong bảng "trước / sau". */
export const auditFieldLabels: Record<string, string> = {
  username: 'Tên đăng nhập',
  fullName: 'Họ tên',
  email: 'Email',
  phone: 'Số điện thoại',
  avatarUrl: 'Ảnh đại diện',
  isActive: 'Đang hoạt động',
  isDemoAccount: 'Tài khoản demo',
  lastLoginAt: 'Đăng nhập gần nhất',
  roleIds: 'Vai trò',
  code: 'Mã',
  name: 'Tên',
  description: 'Mô tả',
  isSystem: 'Vai trò hệ thống',
  permissions: 'Quyền',
  key: 'Khóa',
  value: 'Giá trị',
  groupName: 'Nhóm',
  quickLogin: 'Đăng nhập nhanh',
  sortOrder: 'Thứ tự',
  status: 'Trạng thái',
  createdAt: 'Ngày tạo',
  updatedAt: 'Ngày sửa',
  // Spa (docs/06 §4)
  groupId: 'Nhóm dịch vụ',
  color: 'Màu',
  price: 'Giá',
  durationMinutes: 'Thời lượng (phút)',
  cleanupMinutes: 'Dọn phòng (phút)',
  commissionType: 'Kiểu hoa hồng',
  commissionRate: 'Hoa hồng (%)',
  commissionValue: 'Hoa hồng cố định',
  allowOnline: 'Cho đặt online',
  isVisible: 'Đang hiển thị',
  imageUrl: 'Ảnh',
  minIntervalDays: 'Cách buổi tối thiểu (ngày)',
  serviceId: 'Dịch vụ',
  sessions: 'Số buổi',
  validityMonths: 'Hạn dùng (tháng)',
  specialty: 'Chuyên môn',
  userId: 'Tài khoản đăng nhập',
  serviceIds: 'Dịch vụ làm được',
  shifts: 'Lịch tuần',
  staffMemberId: 'Nhân viên',
  date: 'Ngày',
  kind: 'Loại nghỉ',
  reason: 'Lý do',
  dayOfWeek: 'Thứ',
  openMinute: 'Giờ mở',
  closeMinute: 'Giờ đóng',
  gender: 'Giới tính',
  birthDate: 'Ngày sinh',
  note: 'Ghi chú',
}

export const entityLabel = (name: string) => auditEntityLabels[name] ?? name
export const fieldLabel = (name: string) => auditFieldLabels[name] ?? name
