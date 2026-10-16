'use client'

import { useSearchParams } from 'next/navigation'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { routePath } from '@/config/route-path'
import { useInvoice, useStoreProfile } from '@/features/booking/hooks/use-spa'
import { InvoiceReceipt } from '../components/InvoiceReceipt'
import { ReceiptFrame } from '../components/ReceiptFrame'

/** Bản in hóa đơn 80 mm (SCR-06). Mở từ hộp thanh toán kèm `?print=1` thì tự mở hộp in. */
export function InvoicePrintPage({ id }: { id: string }) {
  const params = useSearchParams()
  const invoice = useInvoice(id)
  const store = useStoreProfile()
  const ready = !!invoice.data && !!store.data
  const backHref = invoice.data?.appointmentId ? routePath.appointmentDetail(invoice.data.appointmentId) : routePath.packages

  return (
    <ReceiptFrame autoPrint={params.get('print') === '1'} ready={ready} backHref={backHref}>
      {invoice.error ? (
        <ErrorState error={invoice.error} title="Không tải được hóa đơn" onRetry={() => invoice.refetch()} />
      ) : invoice.data ? (
        <InvoiceReceipt invoice={invoice.data} store={store.data} />
      ) : (
        <div className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}
    </ReceiptFrame>
  )
}
