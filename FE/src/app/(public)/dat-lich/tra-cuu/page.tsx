import { Suspense } from 'react'
import type { Metadata } from 'next'
import { BookingLookupPage } from '@/features/public-booking/pages/BookingLookupPage'

export const metadata: Metadata = { title: 'Tra cứu lịch hẹn' }

export default function Page() {
  return (
    <Suspense>
      <BookingLookupPage />
    </Suspense>
  )
}
