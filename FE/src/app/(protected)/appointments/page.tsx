import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AppointmentsPage } from '@/features/appointments/pages/AppointmentsPage'

export const metadata: Metadata = { title: 'Lịch hẹn' }

export default function Page() {
  return (
    <Suspense>
      <AppointmentsPage />
    </Suspense>
  )
}
