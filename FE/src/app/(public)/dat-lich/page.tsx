import type { Metadata } from 'next'
import { BookingPage } from '@/features/public-booking/pages/BookingPage'

export const metadata: Metadata = { title: 'Đặt lịch online' }

export default function Page() {
  return <BookingPage />
}
