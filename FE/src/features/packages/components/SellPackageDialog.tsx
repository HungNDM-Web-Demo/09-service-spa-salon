'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PackagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { routePath } from '@/config/route-path'
import { getErrorMessage, getFieldErrors, isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { CustomerPicker } from '@/features/booking/components/CustomerPicker'
import { PaymentPanel, initialPayment, paymentReady, type PaymentState } from '@/features/booking/components/PaymentPanel'
import {
  useCreateCustomer,
  useCustomerLookup,
  usePackageTemplateOptions,
  useSellPackage,
  useStaffOptions,
} from '@/features/booking/hooks/use-spa'
import { paymentErrors } from '@/features/booking/lib/checkout'
import { staffKindLabels } from '@/features/booking/lib/labels'
import { PHONE_PATTERN, digitsOnly } from '@/features/booking/lib/rules'
import { addMonthsKey, ddmmyyyy, vnToday } from '@/features/booking/lib/vn-time'

/** Bán gói riêng (UC-09 luồng chính): chọn khách, gói mẫu đang bán, người tư vấn, thu tiền, mở bản in. */
export function SellPackageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        {open && <SellForm onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SellForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [consultantId, setConsultantId] = useState('')
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const [clientRequestId] = useState(() => crypto.randomUUID())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const digits = digitsOnly(phone)
  const lookup = useCustomerLookup(digits)
  const templates = usePackageTemplateOptions()
  const staff = useStaffOptions()
  const createCustomer = useCreateCustomer()
  const sell = useSellPackage()
  const pending = createCustomer.isPending || sell.isPending

  const template = templates.data?.find((t) => t.id === templateId)
  const total = template?.price ?? 0
  const pay = payment ?? { ...initialPayment(total), cashReceived: total }
  const payErrors = paymentErrors(total, pay.method, pay.cashReceived, pay.cardAuthCode)
  const customer = lookup.data?.customer ?? null
  const customerReady = PHONE_PATTERN.test(digits) && !!lookup.data && (!!customer || newName.trim().length > 0)
  const ready = customerReady && !!template && !!consultantId && paymentReady(total, pay) && !pending

  const submit = async () => {
    if (!ready || !template) return
    setError(null)
    setErrors({})
    try {
      // Khách mới: thêm hồ sơ trước rồi bán gói (BR-28)
      const customerId = customer?.id ?? (await createCustomer.mutateAsync({ phone: digits, fullName: newName.trim() })).id
      const invoice = await sell.mutateAsync({
        clientRequestId,
        customerId,
        packageTemplateId: template.id,
        consultantStaffId: consultantId,
        method: total <= 0 ? 'KhongThu' : pay.method,
        cashReceived: pay.method === 'TienMat' ? pay.cashReceived : null,
        cardAuthCode: pay.method === 'The' ? pay.cardAuthCode : null,
        expectedTotal: total,
      })
      toast.success(`Đã bán gói ${template.name}, hóa đơn ${invoice.code}`)
      onClose()
      router.push(`${routePath.invoicePrint(invoice.id)}?print=1`)
    } catch (err) {
      if (isApiError(err) && err.status === 0) {
        setError('Chưa lưu được do mất kết nối. Bấm "Hoàn tất" lần nữa, hệ thống không tạo trùng hóa đơn.')
        return
      }
      setErrors(getFieldErrors(err))
      setError(getErrorMessage(err))
    }
  }

  return (
    <>
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle className="flex items-center gap-2">
          <PackagePlus className="text-primary size-5" aria-hidden="true" />
          Bán gói liệu trình
        </DialogTitle>
        <DialogDescription>Gói bắt đầu tính hạn từ hôm nay; hoa hồng bán gói ghi cho người tư vấn.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[calc(100svh-13rem)] space-y-5 overflow-y-auto px-6 py-5">
        <CustomerPicker
          phone={phone}
          onPhoneChange={setPhone}
          newName={newName}
          onNewNameChange={setNewName}
          lookup={lookup.data}
          isLooking={lookup.isFetching}
          autoFocus
          errors={{ phone: errors.phone ?? errors.customerId, name: errors.fullName }}
          disabled={pending}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Gói mẫu" required error={errors.packageTemplateId}>
            <Select value={templateId} onValueChange={setTemplateId} disabled={pending}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn gói đang bán" />
              </SelectTrigger>
              <SelectContent>
                {(templates.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {formatVnd(t.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Người tư vấn" required error={errors.consultantStaffId}>
            <Select value={consultantId} onValueChange={setConsultantId} disabled={pending}>
              <SelectTrigger>
                <SelectValue placeholder="Kỹ thuật viên hoặc lễ tân" />
              </SelectTrigger>
              <SelectContent>
                {(staff.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName} · {staffKindLabels[s.kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        {template && (
          <dl className="bg-muted/40 grid grid-cols-2 gap-3 rounded-lg p-3 text-sm sm:grid-cols-4">
            <Info label="Số buổi" value={`${template.sessions} buổi ${template.serviceName}`} />
            <Info label="Hạn dùng dự kiến" value={ddmmyyyy(addMonthsKey(vnToday(), template.validityMonths))} />
            <Info label="Giá lẻ tương đương" value={formatVnd(template.retailEquivalent)} />
            <Info label="Tiết kiệm" value={`${formatVnd(template.savingAmount)} (${template.savingPercent}%)`} />
          </dl>
        )}
        {template && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Tổng tiền</span>
              <span className="tabular-nums">{formatVnd(total)}</span>
            </div>
            <PaymentPanel total={total} value={pay} onChange={setPayment} transferContent={`GOI ${digits}`} errors={payErrors} disabled={pending} />
          </div>
        )}
        {error && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        )}
      </div>
      <DialogFooter className="border-t px-6 py-4">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Hủy
        </Button>
        <Button variant="cta" onClick={submit} disabled={!ready}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Hoàn tất {template ? formatVnd(total) : ''}
        </Button>
      </DialogFooter>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
