import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PackagesPage } from '@/features/packages/pages/PackagesPage'

export const metadata: Metadata = { title: 'Gói liệu trình' }

export default function Page() {
  return (
    <Suspense>
      <PackagesPage />
    </Suspense>
  )
}
