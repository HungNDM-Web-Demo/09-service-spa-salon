'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Ban, CalendarPlus, Loader2, Printer, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatPhone, formatVnd } from '@/lib/format'
import type { CustomerPackageDetailDto } from '@/types/spa'
import { PackageStatusBadge } from '@/features/booking/components/SpaBadges'
import { useCustomerPackage, useExtendPackage, useInvoice } from '@/features/booking/hooks/use-spa'
import { bookingRules } from '@/features/booking/lib/rules'
import { addDaysKey, ddmmyyyy, vnDdMmYyyy, vnHhmmDate } from '@/features/booking/lib/vn-time'
import { CancelInvoiceDialog } from '@/features/invoices/components/CancelInvoiceDialog'

/** Chi tiết gói của khách (UC-09 1b, UC-16): số buổi, lịch sử trừ buổi, gia hạn, hủy hóa đơn bán gói riêng (UC-10). */
export function PackageDetailSheet({ packageId, onOpenChange }: { packageId: string | null; onOpenChange: (o: boolean) => void }) {
  const { can } = usePermissions()
  const query = useCustomerPackage(packageId)
  const p = query.data
  const invoice = useInvoice(p && can(permissions.invoices.cancel) ? p.invoiceId : null)
  const [extendOpen, setExtendOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const standaloneSale = !!invoice.data && invoice.data.appointmentId === null

  return (
    <Sheet open={!!packageId} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b p-5">
          {p ? (
            <>
              <SheetTitle className="flex flex-wrap items-center gap-2 pr-8">
                {p.packageName}
                <PackageStatusBadge status={p.status} />
              </SheetTitle>
              <SheetDescription className="tabular-nums">
                {p.code} · {p.customerName} · {formatPhone(p.customerPhone)}
              </SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle>
                <Skeleton className="h-6 w-56" />
              </SheetTitle>
              <SheetDescription className="sr-only">Đang tải gói</SheetDescription>
            </>
          )}
        </SheetHeader>
        {p && (
          <div className="space-y-5 p-5 text-sm">
            <div className="space-y-2">
              <div className="flex items-end justify-between">
                <span className="text-muted-foreground">Còn lại</span>
                <span className="text-2xl font-semibold tabular-nums">
                  {p.remaining}
                  <span className="text-muted-foreground text-base font-normal">/{p.totalSessions} buổi</span>
                </span>
              </div>
              <Progress value={(p.usedSessions / Math.max(1, p.totalSessions)) * 100} aria-label="Số buổi đã dùng" />
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Info label="Ngày mua" value={vnDdMmYyyy(p.purchasedAt)} />
              <Info
                label="Hạn dùng"
                value={`${ddmmyyyy(p.expiryDate)}${p.extendedDays ? ` (gia hạn ${p.extendedDays} ngày)` : ''}`}
                tone={p.expiringSoon ? 'text-warning' : undefined}
              />
              <Info label="Giá gói" value={formatVnd(p.price)} />
              <Info label="Giá trị một buổi" value={formatVnd(p.sessionValue)} />
              <Info label="Khoảng cách tối thiểu" value={p.minIntervalDays ? `${p.minIntervalDays} ngày` : 'Không yêu cầu'} />
              <Info label="Người tư vấn" value={p.consultantName} />
            </dl>
            {p.extendReason && <p className="text-muted-foreground">Lý do gia hạn: {p.extendReason}</p>}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={routePath.invoicePrint(p.invoiceId)}>
                  <Printer aria-hidden="true" />
                  Hóa đơn {p.invoiceCode}
                </Link>
              </Button>
              {can(permissions.customerPackages.extend) && p.canExtend && (
                <Button variant="outline" size="sm" onClick={() => setExtendOpen(true)}>
                  <CalendarPlus aria-hidden="true" />
                  Gia hạn
                </Button>
              )}
              {standaloneSale && invoice.data?.status === 'DaThanhToan' && (
                invoice.data.canCancel ? (
                  <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
                    <Ban aria-hidden="true" />
                    Hủy hóa đơn bán gói
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button variant="destructive" size="sm" disabled>
                          <Ban aria-hidden="true" />
                          Hủy hóa đơn bán gói
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{invoice.data.cancelBlockedReason ?? 'Không hủy được hóa đơn này'}</TooltipContent>
                  </Tooltip>
                )
              )}
            </div>

            <section className="space-y-2">
              <h3 className="font-semibold">Lịch sử trừ buổi</h3>
              {p.usages.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border px-3 py-4 text-center">Chưa dùng buổi nào.</p>
              ) : (
                <ol className="divide-y rounded-lg border">
                  {p.usages.map((u) => (
                    <li key={u.id} className="flex items-start gap-3 px-3 py-2.5">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${u.refunded ? 'bg-muted-foreground' : 'bg-primary'}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className={u.refunded ? 'text-muted-foreground line-through' : 'font-medium'}>
                          <span className="tabular-nums">{vnHhmmDate(u.usedAt)}</span> · {u.staffName}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {u.appointmentId ? (
                            <Link href={routePath.appointmentDetail(u.appointmentId)} className="text-primary hover:underline">
                              {u.appointmentCode}
                            </Link>
                          ) : null}
                          {u.appointmentCode ? ' · ' : ''}
                          {u.invoiceCode}
                        </p>
                        {u.overrideReason && <p className="text-warning text-xs">Trừ sớm: {u.overrideReason}</p>}
                      </div>
                      {u.refunded && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                          <Undo2 className="size-3.5" aria-hidden="true" />
                          Đã hoàn buổi
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
        {p && <ExtendDialog pkg={p} open={extendOpen} onOpenChange={setExtendOpen} />}
        <CancelInvoiceDialog invoice={cancelOpen && p ? { id: p.invoiceId, code: p.invoiceCode } : null} onOpenChange={setCancelOpen} />
      </SheetContent>
    </Sheet>
  )
}

function ExtendDialog({ pkg, open, onOpenChange }: { pkg: CustomerPackageDetailDto; open: boolean; onOpenChange: (o: boolean) => void }) {
  const extend = useExtendPackage()
  const [days, setDays] = useState(30)
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const submit = () => {
    const local: Record<string, string> = {}
    if (!Number.isInteger(days) || days < 1 || days > bookingRules.maxExtendDays) local.days = `Gia hạn từ 1 đến ${bookingRules.maxExtendDays} ngày`
    if (!reason.trim()) local.reason = 'Nhập lý do gia hạn'
    setErrors(local)
    if (Object.keys(local).length) return
    extend.mutate(
      { id: pkg.id, days, reason: reason.trim() },
      {
        onSuccess: (p) => {
          toast.success(`Đã gia hạn gói ${p.code} tới ${ddmmyyyy(p.expiryDate)}`)
          onOpenChange(false)
        },
        onError: (err) => {
          setErrors(getFieldErrors(err))
          toast.error(getErrorMessage(err))
        },
      }
    )
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !extend.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gia hạn gói {pkg.code}</DialogTitle>
          <DialogDescription>
            Hạn hiện tại {ddmmyyyy(pkg.expiryDate)}. Gia hạn tối đa {bookingRules.maxExtendDays} ngày, chỉ chủ tiệm thực hiện.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <FormField
            label="Số ngày gia hạn"
            required
            error={errors.days}
            hint={days > 0 ? `Hạn mới: ${ddmmyyyy(addDaysKey(pkg.expiryDate, days))}` : undefined}
          >
            <Input
              inputMode="numeric"
              value={days || ''}
              onChange={(e) => setDays(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0)}
              className="tabular-nums"
            />
          </FormField>
          <FormField label="Lý do" required error={errors.reason}>
            <Textarea rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vd khách nằm viện 1 tháng" />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={extend.isPending}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={extend.isPending}>
            {extend.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Gia hạn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Info({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`font-medium tabular-nums ${tone ?? ''}`}>{value}</dd>
    </div>
  )
}
