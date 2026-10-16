'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/api-error'
import { useCancelInvoice } from '@/features/booking/hooks/use-spa'

/** Hủy hóa đơn (UC-10): nhập lý do; buổi gói, hoa hồng được trả lại, lịch về "Đang phục vụ". */
export function CancelInvoiceDialog({ invoice, onOpenChange }: { invoice: { id: string; code: string } | null; onOpenChange: (o: boolean) => void }) {
  const cancel = useCancelInvoice()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | undefined>()
  return (
    <ConfirmDialog
      open={!!invoice}
      onOpenChange={(o) => {
        if (!o) {
          setReason('')
          setError(undefined)
        }
        onOpenChange(o)
      }}
      title={`Hủy hóa đơn ${invoice?.code ?? ''}?`}
      description="Buổi gói đã trừ được trả lại, gói bán trong hóa đơn bị hủy, hoa hồng của hóa đơn bị xóa; lịch hẹn quay về Đang phục vụ để thanh toán lại."
      confirmText="Hủy hóa đơn"
      variant="destructive"
      icon={Ban}
      loading={cancel.isPending}
      onConfirm={() =>
        new Promise<void>((resolve, reject) => {
          if (!invoice) return resolve()
          if (!reason.trim()) {
            setError('Nhập lý do hủy')
            return reject(new Error('missing reason'))
          }
          cancel.mutate(
            { id: invoice.id, reason: reason.trim() },
            {
              onSuccess: (inv) => {
                toast.success(`Đã hủy hóa đơn ${inv.code}`)
                setReason('')
                resolve()
              },
              onError: (err) => {
                setError(getErrorMessage(err))
                reject(err)
              },
            }
          )
        })
      }
    >
      <FormField label="Lý do hủy" required error={error}>
        <Textarea rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vd thu nhầm dịch vụ" />
      </FormField>
    </ConfirmDialog>
  )
}
