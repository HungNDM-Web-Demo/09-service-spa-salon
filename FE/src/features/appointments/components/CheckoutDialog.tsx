'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, Package, PackagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, isApiError } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CheckoutPreviewDto, DiscountType, PackageTemplateDto, StaffOption } from '@/types/spa'
import { MoneyInput } from '@/features/booking/components/MoneyInput'
import { PaymentPanel, initialPayment, paymentReady, type PaymentState } from '@/features/booking/components/PaymentPanel'
import { useCheckout, useCheckoutPreview, usePackageTemplateOptions, useStaffOptions } from '@/features/booking/hooks/use-spa'
import { computeCheckout, paymentErrors } from '@/features/booking/lib/checkout'
import { discountReasons } from '@/features/booking/lib/labels'
import { problemCode, problemServerTotal } from '@/features/booking/lib/problem'
import { ddmmyyyy, vnDateKey } from '@/features/booking/lib/vn-time'

type CheckoutDialogProps = {
  appointmentId: string | null
  onOpenChange: (open: boolean) => void
}

/** Hộp thanh toán (SCR-05; UC-08, UC-09 1a): trừ buổi, bán gói kèm, giảm giá, thu tiền, mở bản in. */
export function CheckoutDialog({ appointmentId, onOpenChange }: CheckoutDialogProps) {
  const preview = useCheckoutPreview(appointmentId)
  return (
    <Dialog open={!!appointmentId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Thanh toán {preview.data ? preview.data.appointmentCode : ''}</DialogTitle>
          <DialogDescription>
            {preview.data
              ? `${preview.data.customer.fullName} · ${preview.data.customer.phone}`
              : 'Đang tải các dòng dịch vụ, gói của khách…'}
          </DialogDescription>
        </DialogHeader>
        {preview.isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : preview.error ? (
          <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
        ) : preview.data ? (
          <CheckoutForm
            key={preview.data.appointmentId}
            preview={preview.data}
            onClose={() => onOpenChange(false)}
            onRefresh={() => preview.refetch()}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

type SaleDraft = { key: number; templateId: string; consultantId: string }

function CheckoutForm({ preview, onClose, onRefresh }: { preview: CheckoutPreviewDto; onClose: () => void; onRefresh: () => void }) {
  const router = useRouter()
  const { can } = usePermissions()
  const canSell = can(permissions.customerPackages.sell)
  const templates = usePackageTemplateOptions(canSell)
  const staff = useStaffOptions()
  const checkout = useCheckout()

  const [clientRequestId] = useState(() => crypto.randomUUID())
  const [usePackage, setUsePackage] = useState<Record<string, boolean>>({})
  const [sales, setSales] = useState<SaleDraft[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>('PhanTram')
  const [discountValue, setDiscountValue] = useState<number | null>(null)
  const [discountReason, setDiscountReason] = useState('')
  const [discountOther, setDiscountOther] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const templateMap = useMemo(() => new Map((templates.data ?? []).map((t) => [t.id, t])), [templates.data])
  const staffMap = useMemo(() => new Map((staff.data ?? []).map((s) => [s.id, s])), [staff.data])
  const reasonText = discountReason === 'Khác' ? discountOther.trim() : discountReason

  const result = useMemo(
    () =>
      computeCheckout({
        lines: preview.lines.map((l) => ({
          lineId: l.appointmentLineId,
          serviceId: l.serviceId,
          serviceName: l.serviceName,
          staffId: l.staffMemberId,
          staffName: l.staffName,
          price: l.price,
          duration: l.durationMinutes,
          commissionType: l.commissionType,
          commissionValue: l.commissionValue,
          usePackage: usePackage[l.appointmentLineId],
        })),
        packages: preview.packages.map((p) => ({
          id: p.id,
          code: p.code,
          serviceId: p.serviceId,
          status: p.status,
          remaining: p.remaining,
          expiryDate: p.expiryDate,
          minIntervalDays: p.minIntervalDays,
          lastUsedDate: p.lastUsedAt ? vnDateKey(p.lastUsedAt) : null,
          sessionValue: p.sessionValue,
        })),
        sales: sales
          .map((s) => ({ draft: s, t: templateMap.get(s.templateId) }))
          .filter((x): x is { draft: SaleDraft; t: PackageTemplateDto } => !!x.t)
          .map(({ draft, t }) => ({
            templateId: t.id,
            templateCode: t.code,
            name: t.name,
            serviceId: t.serviceId,
            serviceName: t.serviceName,
            sessions: t.sessions,
            price: t.price,
            validityMonths: t.validityMonths,
            minIntervalDays: t.minIntervalDays,
            commissionRate: t.commissionRate,
            consultantId: draft.consultantId,
            consultantName: staffMap.get(draft.consultantId)?.fullName ?? '',
          })),
        discount: discountValue ? { type: discountType, value: discountValue, reason: reasonText || null } : null,
        payDate: preview.today,
        discountLimitPercent: preview.discountLimitPercent,
      }),
    [preview, usePackage, sales, templateMap, staffMap, discountType, discountValue, reasonText]
  )

  const total = result.total
  const pay = payment ?? initialPayment(total)
  // Đổi tổng thì tiền khách đưa mặc định theo tổng mới (lễ tân chưa gõ số khác)
  const effectivePay = payment === null ? { ...pay, cashReceived: total } : pay
  const payErrors = paymentErrors(total, effectivePay.method, effectivePay.cashReceived, effectivePay.cardAuthCode)
  const salesIncomplete = sales.some((s) => !s.templateId || !s.consultantId)
  const overrideMissing = result.requiresOverrideReason && !overrideReason.trim()
  const blocking = Object.keys(result.errors).length > 0 || salesIncomplete || overrideMissing || !paymentReady(total, effectivePay)
  const pending = checkout.isPending
  const limitAmount = result.maxDiscount
  const consultants: StaffOption[] = staff.data ?? []

  const submit = () => {
    if (blocking || pending) return
    setError(null)
    checkout.mutate(
      {
        clientRequestId,
        appointmentId: preview.appointmentId,
        lines: result.lines.map((l) => ({ appointmentLineId: l.line.lineId, usePackage: l.usesPackage })),
        sellPackages: sales.map((s) => ({ packageTemplateId: s.templateId, consultantStaffId: s.consultantId })),
        discount: discountValue ? { type: discountType, value: discountValue, reason: reasonText || null } : null,
        intervalOverrideReason: result.requiresOverrideReason ? overrideReason.trim() : null,
        method: total <= 0 ? 'KhongThu' : effectivePay.method,
        cashReceived: effectivePay.method === 'TienMat' ? effectivePay.cashReceived : null,
        cardAuthCode: effectivePay.method === 'The' ? effectivePay.cardAuthCode : null,
        expectedTotal: total,
      },
      {
        onSuccess: (invoice) => {
          toast.success(`Đã thanh toán, hóa đơn ${invoice.code}`)
          onClose()
          router.push(`${routePath.invoicePrint(invoice.id)}?print=1`)
        },
        onError: (err) => {
          if (isApiError(err) && err.status === 0) {
            setError('Chưa lưu được hóa đơn do mất kết nối. Bấm "Hoàn tất" lần nữa, hệ thống không tạo trùng hóa đơn.')
            return
          }
          if (problemCode(err) === 'TongTienDaDoi') {
            const server = problemServerTotal(err)
            setError(`${getErrorMessage(err)}${server !== null ? ` Tổng mới: ${formatVnd(server)}.` : ''} Kiểm tra lại rồi bấm Hoàn tất.`)
            onRefresh()
            return
          }
          setError(getErrorMessage(err))
        },
      }
    )
  }

  return (
    <>
      <div className="max-h-[calc(100svh-13rem)] space-y-5 overflow-y-auto px-6 py-5">
        {/* Dòng dịch vụ */}
        <section className="space-y-2" aria-label="Dịch vụ">
          {result.lines.map((r) => (
            <div key={r.line.lineId} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.line.serviceName}</p>
                  <p className="text-muted-foreground text-xs">KTV {r.line.staffName}</p>
                </div>
                {r.eligible && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Switch
                      checked={r.usesPackage}
                      disabled={pending}
                      onCheckedChange={(c) => setUsePackage((m) => ({ ...m, [r.line.lineId]: c }))}
                    />
                    Trừ buổi
                  </label>
                )}
                <div className="w-28 text-right">
                  {r.usesPackage ? (
                    <>
                      <p className="font-semibold tabular-nums">0 ₫</p>
                      <p className="text-muted-foreground text-xs line-through tabular-nums">{formatVnd(r.line.price)}</p>
                    </>
                  ) : (
                    <p className="font-semibold tabular-nums">{formatVnd(r.amount)}</p>
                  )}
                </div>
              </div>
              {r.usesPackage && r.package && (
                <p className="text-primary mt-1.5 flex items-center gap-1 text-[0.8125rem] font-medium">
                  <Package className="size-3.5" aria-hidden="true" />
                  {r.package.code ? `Trừ gói ${r.package.code}` : 'Trừ gói vừa bán kèm'}, còn {r.package.remainingAfter} buổi, hạn{' '}
                  {ddmmyyyy(r.package.expiryDate)}
                </p>
              )}
              {r.packageNote && <p className="text-muted-foreground mt-1.5 text-[0.8125rem]">{r.packageNote}</p>}
              {r.intervalWarning && (
                <p className="text-warning mt-1.5 flex items-center gap-1 text-[0.8125rem] font-medium">
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  {r.intervalWarning}
                </p>
              )}
            </div>
          ))}
          {result.requiresOverrideReason && (
            <FormField label="Lý do trừ buổi khi chưa đủ khoảng cách" required error={overrideMissing ? 'Nhập lý do để tiếp tục' : undefined}>
              <Textarea
                rows={2}
                maxLength={200}
                value={overrideReason}
                placeholder="Vd khách đi công tác dài ngày, xin làm sớm"
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </FormField>
          )}
        </section>

        {/* Bán gói kèm */}
        {canSell && (
          <section className="space-y-2" aria-label="Bán gói kèm">
            {sales.map((s) => {
              const t = templateMap.get(s.templateId)
              return (
                <div key={s.key} className="bg-muted/40 grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_7rem_auto]">
                  <Select value={s.templateId} onValueChange={(v) => setSales((l) => l.map((x) => (x.key === s.key ? { ...x, templateId: v } : x)))}>
                    <SelectTrigger aria-label="Gói bán kèm">
                      <SelectValue placeholder="Chọn gói" />
                    </SelectTrigger>
                    <SelectContent>
                      {(templates.data ?? []).map((tp) => (
                        <SelectItem key={tp.id} value={tp.id}>
                          {tp.name} · {formatVnd(tp.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={s.consultantId}
                    onValueChange={(v) => setSales((l) => l.map((x) => (x.key === s.key ? { ...x, consultantId: v } : x)))}
                  >
                    <SelectTrigger aria-label="Người tư vấn">
                      <SelectValue placeholder="Người tư vấn" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultants.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="flex items-center justify-end font-semibold tabular-nums">{t ? formatVnd(t.price) : '—'}</p>
                  <Button variant="ghost" size="icon" aria-label="Bỏ gói bán kèm" onClick={() => setSales((l) => l.filter((x) => x.key !== s.key))}>
                    <Trash2 />
                  </Button>
                  {t && (
                    <p className="text-muted-foreground text-xs sm:col-span-4">
                      {t.sessions} buổi {t.serviceName}, hạn {t.validityMonths} tháng, tiết kiệm {formatVnd(t.savingAmount)} ({t.savingPercent}%)
                    </p>
                  )}
                </div>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setSales((l) => [...l, { key: Date.now(), templateId: '', consultantId: '' }])}
            >
              <PackagePlus aria-hidden="true" />
              Bán gói kèm
            </Button>
          </section>
        )}

        {/* Giảm giá */}
        {preview.discountLimitPercent > 0 && result.serviceTotal > 0 && (
          <section className="grid gap-3 sm:grid-cols-[auto_10rem_1fr]" aria-label="Giảm giá">
            <FormField label="Giảm giá">
              <div className="flex h-10 overflow-hidden rounded-md border">
                {(['PhanTram', 'SoTien'] as DiscountType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={discountType === t}
                    onClick={() => {
                      setDiscountType(t)
                      setDiscountValue(null)
                    }}
                    className={cn('w-12 cursor-pointer text-sm font-medium', discountType === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                  >
                    {t === 'PhanTram' ? '%' : '₫'}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField
              label={discountType === 'PhanTram' ? 'Phần trăm' : 'Số tiền'}
              hint={`Tối đa ${preview.discountLimitPercent}% (${formatVnd(limitAmount)})`}
              error={result.errors['discount.value']}
            >
              {discountType === 'PhanTram' ? (
                <Input
                  inputMode="numeric"
                  value={discountValue ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 3)
                    setDiscountValue(v ? Number(v) : null)
                  }}
                  className="text-right tabular-nums"
                />
              ) : (
                <MoneyInput value={discountValue} onValueChange={setDiscountValue} />
              )}
            </FormField>
            <FormField label="Lý do giảm" required={!!discountValue} error={result.errors['discount.reason']}>
              <div className="flex gap-2">
                <Select value={discountReason} onValueChange={setDiscountReason}>
                  <SelectTrigger className="min-w-0 flex-1">
                    <SelectValue placeholder="Chọn lý do" />
                  </SelectTrigger>
                  <SelectContent>
                    {discountReasons.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {discountReason === 'Khác' && (
                  <Input
                    aria-label="Lý do khác"
                    className="min-w-0 flex-1"
                    maxLength={200}
                    value={discountOther}
                    onChange={(e) => setDiscountOther(e.target.value)}
                  />
                )}
              </div>
            </FormField>
          </section>
        )}

        {/* Tổng */}
        <section className="bg-muted/40 space-y-1 rounded-lg p-3 text-sm">
          <Row label="Dịch vụ lẻ" value={formatVnd(result.serviceTotal)} />
          {result.packageTotal > 0 && <Row label="Gói bán kèm" value={formatVnd(result.packageTotal)} />}
          {result.discountAmount > 0 && <Row label="Giảm giá" value={`−${formatVnd(result.discountAmount)}`} />}
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>Tổng tiền</span>
            <span className="tabular-nums">{formatVnd(total)}</span>
          </div>
        </section>

        <PaymentPanel
          total={total}
          value={effectivePay}
          onChange={setPayment}
          transferContent={preview.appointmentCode}
          errors={payErrors}
          disabled={pending}
        />

        {error && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        )}
      </div>
      <DialogFooter className="border-t px-6 py-4">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Đóng
        </Button>
        <Button variant="cta" onClick={submit} disabled={blocking || pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Hoàn tất {formatVnd(total)}
        </Button>
      </DialogFooter>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
