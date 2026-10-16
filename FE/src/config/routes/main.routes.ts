import { CalendarClock, CalendarDays, ExternalLink, LayoutDashboard, Package, Users } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/** Nhóm menu chính: việc hằng ngày ở quầy và của kỹ thuật viên (docs/07 §6). */
export const mainRoutes: NavGroup = {
  id: 'main',
  items: [
    {
      title: 'Tổng quan',
      href: routePath.dashboard,
      icon: LayoutDashboard,
      permission: permissions.dashboard.view,
      description: 'Lịch hôm nay, lịch chờ xác nhận, thực thu',
    },
    {
      title: 'Lịch hẹn',
      href: routePath.appointments,
      icon: CalendarDays,
      permission: permissions.appointments.view,
      description: 'Lưới lịch theo kỹ thuật viên, kéo thả đổi giờ',
    },
    {
      title: 'Lịch của tôi',
      href: routePath.mySchedule,
      icon: CalendarClock,
      permission: permissions.appointments.viewOwn,
      description: 'Lịch làm và hoa hồng của kỹ thuật viên',
    },
    {
      title: 'Khách hàng',
      href: routePath.customers,
      icon: Users,
      permission: permissions.customers.view,
      description: 'Hồ sơ, lịch sử, gói của khách',
    },
    {
      title: 'Gói liệu trình',
      href: routePath.packages,
      icon: Package,
      permission: [permissions.customerPackages.view, permissions.packages.view],
      description: 'Bán gói, theo dõi số buổi, hạn dùng',
    },
    {
      title: 'Trang đặt lịch',
      href: routePath.booking,
      icon: ExternalLink,
      permission: permissions.appointments.view,
      description: 'Trang khách tự đặt lịch online',
      newTab: true,
    },
  ],
}
