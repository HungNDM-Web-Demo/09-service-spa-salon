'use client'

import { useState } from 'react'
import { CalendarX2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import type { AppointmentDetailDto, CancelReason } from '@/types/spa'
import { useCancelAppointment, useRejectAppointment } from '@/features/booking/hooks/use-spa'
import { cancelReasonOptions, rejectReasonOptions } from '@/features/booking/lib/labels'
import { validateCancel } from '@/features/booking/lib/validation'

type CancelAppointmentDialogProps = {
  appointment: AppointmentDetailDto
  /** reject: từ chối lịch online chờ xác nhận (UC-05 3a); cancel: hủy lịch (UC-05 1b) */
  mode: 'cancel' | 'reject' | null
  onOpenChange: (open: boolean) => void
}

/** Chọn lý do hủy hoặc từ chối; "Khác" bắt buộc ghi chú; chưa chọn lý do thì nút xác nhận khóa (UC-05 E3). */
export function CancelAppointmentDialog({ appointment, mode, onOpenChange }: CancelAppointmentDialogProps) {
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mode && <CancelForm key={mode} appointment={appointment} mode={mode} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CancelForm({ appointment, mode, onClose }: { appointment: AppointmentDetailDto; mode: 'cancel' | 'reject'; onClose: () => void }) {
  const [reason, setReason] = useState<CancelReason | ''>('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const cancel = useCancelAppointment()
  const reject = useRejectAppointment()
  const pending = cancel.isPending || reject.isPending
  const options = mode === 'reject' ? rejectReasonOptions : cancelReasonOptions

  const submit = () => {
    if (!reason) return
    const input = { reason, note: note.trim() || null }
    const local = validateCancel(input)
    setErrors(local)
    if (Object.keys(local).length) return
    const mutation = mode === 'reject' ? reject : cancel
    mutation.mutate(
      { id: appointment.id, input },
      {
        onSuccess: (a) => {
          toast.success(`${mode === 'reject' ? 'Đã từ chối' : 'Đã hủy'} lịch ${a.code}, đã gửi tin hủy (giả lập)`)
          onClose()
        },
        onError: (err) => {
          setErrors(getFieldErrors(err))
          toast.error(getErrorMessage(err))
        },
      }
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarX2 className="text-destructive size-5" aria-hidden="true" />
          {mode === 'reject' ? `Từ chối lịch ${appointment.code}` : `Hủy lịch ${appointment.code}`}
        </DialogTitle>
        <DialogDescription>
          {appointment.customerName} · Lịch rời khỏi lưới, chỗ trống trở lại. Khách nhận tin hủy kèm lý do.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as CancelReason)} aria-label="Lý do" className="gap-2">
          {options.map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem id={`reason-${o.value}`} value={o.value} />
              <Label htmlFor={`reason-${o.value}`} className="cursor-pointer font-normal">
                {o.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {errors.reason && <p className="text-destructive text-sm">{errors.reason}</p>}
        <FormField label="Ghi chú" required={reason === 'Khac'} error={errors.note}>
          <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Đóng
        </Button>
        <Button variant="danger" onClick={submit} disabled={!reason || pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {mode === 'reject' ? 'Xác nhận từ chối' : 'Xác nhận hủy'}
        </Button>
      </DialogFooter>
    </>
  )
}
