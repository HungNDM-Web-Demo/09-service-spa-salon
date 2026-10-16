import type { Metadata } from 'next'
import { CommissionsPage } from '@/features/commissions/pages/CommissionsPage'

export const metadata: Metadata = { title: 'Hoa hồng' }

export default function Page() {
  return <CommissionsPage />
}
