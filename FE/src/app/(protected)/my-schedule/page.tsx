import type { Metadata } from 'next'
import { MySchedulePage } from '@/features/commissions/pages/MySchedulePage'

export const metadata: Metadata = { title: 'Lịch của tôi' }

export default function Page() {
  return <MySchedulePage />
}
