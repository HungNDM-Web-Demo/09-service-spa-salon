import type { Metadata } from 'next'
import { PublicShell } from '@/features/public-booking/components/PublicShell'

/** Trang khách công khai (SCR-07, SCR-08): không AuthGuard, không sidebar, không lập chỉ mục. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>
}
