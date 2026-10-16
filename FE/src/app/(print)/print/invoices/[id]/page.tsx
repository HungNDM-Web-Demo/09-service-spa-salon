import { Suspense } from 'react'
import type { Metadata } from 'next'
import { InvoicePrintPage } from '@/features/invoices/pages/InvoicePrintPage'

export const metadata: Metadata = { title: 'In hóa đơn' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <InvoicePrintPage key={id} id={id} />
    </Suspense>
  )
}
