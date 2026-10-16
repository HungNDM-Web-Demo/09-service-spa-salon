import { Suspense } from 'react'
import type { Metadata } from 'next'
import { StaffPage } from '@/features/staff/pages/StaffPage'

export const metadata: Metadata = { title: 'Nhân viên' }

export default function Page() {
  return (
    <Suspense>
      <StaffPage />
    </Suspense>
  )
}
