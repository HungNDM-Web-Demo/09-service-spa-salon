import { AuthGuard } from '@/features/auth/components/AuthGuard'

/** Trang in hóa đơn: cần đăng nhập, không sidebar, CSS @page 80 mm (SCR-06). */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
