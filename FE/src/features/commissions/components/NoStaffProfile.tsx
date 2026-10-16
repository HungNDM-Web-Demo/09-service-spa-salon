import { UserX } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { isApiError } from '@/lib/api-error'

/** API lịch, hoa hồng của tôi trả 404/400 khi tài khoản chưa liên kết hồ sơ nhân viên (07 §4.8) */
export const isNoStaffProfile = (error: unknown): boolean => isApiError(error) && (error.status === 404 || error.status === 400)

/** Trạng thái trống thân thiện thay cho báo lỗi khi tài khoản chưa liên kết nhân viên */
export function NoStaffProfile() {
  return (
    <EmptyState
      icon={UserX}
      title="Tài khoản chưa liên kết hồ sơ kỹ thuật viên"
      description="Nhờ chủ tiệm vào trang Nhân viên, mở hồ sơ của bạn và chọn tài khoản đăng nhập này để xem lịch và hoa hồng."
      className="bg-card rounded-xl border shadow-xs"
    />
  )
}
