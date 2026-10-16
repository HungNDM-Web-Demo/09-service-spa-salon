import { BarChart3, HandCoins, Sparkles, UserCog } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/** Nhóm Quản lý: danh mục, nhân viên, hoa hồng, báo cáo (chủ tiệm). */
export const manageRoutes: NavGroup = {
  id: 'manage',
  label: 'Quản lý',
  items: [
    {
      title: 'Dịch vụ',
      href: routePath.services,
      icon: Sparkles,
      // Kỹ thuật viên có services.view (đọc tên dịch vụ) nhưng không cần màn quản lý dịch vụ
      permission: [permissions.services.create, permissions.services.update, permissions.staffMembers.view],
      description: 'Dịch vụ, bảng giá, nhóm dịch vụ, mức hoa hồng',
    },
    {
      title: 'Nhân viên',
      href: routePath.staff,
      icon: UserCog,
      permission: permissions.staffMembers.view,
      description: 'Kỹ thuật viên, lịch tuần, ngày nghỉ, giờ mở cửa',
    },
    {
      title: 'Hoa hồng',
      href: routePath.commissions,
      icon: HandCoins,
      permission: permissions.commissions.view,
      description: 'Bảng hoa hồng tháng, chốt và chi trả',
    },
    {
      title: 'Báo cáo',
      href: routePath.reports,
      icon: BarChart3,
      permission: permissions.reports.view,
      description: 'Doanh thu, dịch vụ, kỹ thuật viên, gói, hủy lịch',
    },
  ],
}
