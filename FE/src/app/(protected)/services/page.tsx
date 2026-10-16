import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ServicesPage } from '@/features/services/pages/ServicesPage'

export const metadata: Metadata = { title: 'Dịch vụ' }

export default function Page() {
  return (
    <Suspense>
      <ServicesPage />
    </Suspense>
  )
}
