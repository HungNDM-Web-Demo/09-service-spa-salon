'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import type { CustomerDto, Gender, SaveCustomerInput } from '@/types/spa'
import { useCreateCustomer, useUpdateCustomer } from '@/features/booking/hooks/use-spa'
import { genderLabels } from '@/features/booking/lib/labels'
import { digitsOnly } from '@/features/booking/lib/rules'
import { phoneError } from '@/features/booking/lib/validation'
import { vnToday } from '@/features/booking/lib/vn-time'

type CustomerFormDialogProps = {
  /** null: đóng; 'new': thêm; CustomerDto: sửa */
  target: CustomerDto | 'new' | null
  onOpenChange: (open: boolean) => void
  onSaved?: (c: CustomerDto) => void
}

/** Thêm, sửa hồ sơ khách (UC-13 bước 4): họ tên, SĐT duy nhất (BR-28), ngày sinh, giới tính, ghi chú da và dị ứng. */
export function CustomerFormDialog({ target, onOpenChange, onSaved }: CustomerFormDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {target !== null && (
          <CustomerForm
            key={target === 'new' ? 'new' : target.id}
            customer={target === 'new' ? null : target}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CustomerForm({ customer, onClose, onSaved }: { customer: CustomerDto | null; onClose: () => void; onSaved?: (c: CustomerDto) => void }) {
  const [form, setForm] = useState<SaveCustomerInput>({
    phone: customer?.phone ?? '',
    fullName: customer?.fullName ?? '',
    birthDate: customer?.birthDate ?? null,
    gender: customer?.gender ?? null,
    note: customer?.note ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const pending = create.isPending || update.isPending
  const set = (patch: Partial<SaveCustomerInput>) => setForm((f) => ({ ...f, ...patch }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input: SaveCustomerInput = {
      phone: digitsOnly(form.phone),
      fullName: form.fullName.trim(),
      birthDate: form.birthDate || null,
      gender: form.gender || null,
      note: form.note?.trim() || null,
    }
    const local: Record<string, string> = {}
    if (!input.fullName) local.fullName = 'Nhập họ tên'
    const pe = phoneError(input.phone)
    if (pe) local.phone = pe
    setErrors(local)
    if (Object.keys(local).length) return
    const handlers = {
      onSuccess: (c: CustomerDto) => {
        toast.success(customer ? `Đã lưu hồ sơ ${c.fullName}` : `Đã thêm khách ${c.fullName} (${c.code})`)
        onSaved?.(c)
        onClose()
      },
      onError: (err: unknown) => {
        const fields = getFieldErrors(err)
        setErrors(fields)
        if (!Object.keys(fields).length) toast.error(getErrorMessage(err))
      },
    }
    if (customer) update.mutate({ id: customer.id, input }, handlers)
    else create.mutate(input, handlers)
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{customer ? `Sửa hồ sơ ${customer.code}` : 'Thêm khách hàng'}</DialogTitle>
        <DialogDescription>Mỗi số điện thoại là một khách; lịch đặt online tự ghép vào hồ sơ theo số điện thoại.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Họ tên" required error={errors.fullName} className="sm:col-span-2">
          <Input value={form.fullName} maxLength={100} onChange={(e) => set({ fullName: e.target.value })} />
        </FormField>
        <FormField label="Số điện thoại" required error={errors.phone}>
          <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value.replace(/[^\d\s]/g, '') })} />
        </FormField>
        <FormField label="Giới tính" error={errors.gender}>
          <Select value={form.gender ?? 'none'} onValueChange={(v) => set({ gender: v === 'none' ? null : (v as Gender) })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Không rõ</SelectItem>
              {(Object.keys(genderLabels) as Gender[]).map((g) => (
                <SelectItem key={g} value={g}>
                  {genderLabels[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Ngày sinh" error={errors.birthDate}>
          <Input type="date" max={vnToday()} value={form.birthDate ?? ''} onChange={(e) => set({ birthDate: e.target.value || null })} />
        </FormField>
        <FormField label="Ghi chú da, dị ứng" error={errors.note} className="sm:col-span-2" hint="KTV thấy ghi chú này trên Lịch của tôi">
          <Textarea
            rows={3}
            maxLength={500}
            value={form.note ?? ''}
            placeholder="Vd da nhạy cảm, dị ứng AHA"
            onChange={(e) => set({ note: e.target.value })}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Hủy
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Lưu
        </Button>
      </DialogFooter>
    </form>
  )
}
