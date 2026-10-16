'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, CalendarX2, Loader2, Phone, Search } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { routePath } from '@/config/route-path'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { PublicAppointmentDto } from '@/types/spa'
import { AppointmentStatusBadge } from '@/features/booking/components/SpaBadges'
import { usePublicCancel, usePublicLookup } from '@/features/booking/hooks/use-spa'
import { PHONE_PATTERN, digitsOnly } from '@/features/booking/lib/rules'
import { ddmmyyyy, isoWeekdayOf, vnHhmm, weekdayLabel } from '@/features/booking/lib/vn-time'

/** Tra cứu, tự hủy lịch đã đặt (SCR-08, UC-06). `?code=` điền sẵn mã; còn dưới 2 giờ thì hiện hotline (BR-10). */
export function BookingLookupPage() {
  const params = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<PublicAppointmentDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const lookup = usePublicLookup()

  const phoneDigits = digitsOnly(phone)
  const valid = code.trim().length >= 6 && PHONE_PATTERN.test(phoneDigits)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setError(null)
    lookup.mutate(
      { code: code.trim().toUpperCase(), phone: phoneDigits },
      {
        onSuccess: setResult,
        onError: (err) => {
          setResult(null)
          setError(getErrorMessage(err))
        },
      }
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Về trang đặt lịch">
          <Link href={routePath.booking}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Tra cứu lịch đã đặt</h1>
      </div>

      <form onSubmit={submit} className="bg-card space-y-3 rounded-xl border p-4">
        <FormField label="Mã lịch hẹn" required hint="Vd LH261022003, có trong màn đặt thành công hoặc tin nhắn">
          <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))} maxLength={20} autoCapitalize="characters" />
        </FormField>
        <FormField label="Số điện thoại đã đặt" required>
          <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))} />
        </FormField>
        <Button type="submit" className="w-full" size="lg" disabled={!valid || lookup.isPending}>
          {lookup.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
          Tra cứu
        </Button>
        {error && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="bg-card space-y-3 rounded-xl border p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-semibold tabular-nums">{result.code}</span>
            <AppointmentStatusBadge status={result.status} />
          </div>
          <p className="text-muted-foreground">
            {result.customerName} · {result.phoneMasked}
          </p>
          <p className="tabular-nums">
            {weekdayLabel(isoWeekdayOf(result.date))}, {ddmmyyyy(result.date)} · {vnHhmm(result.startAt)}–{vnHhmm(result.endAt)}
          </p>
          <ul className="space-y-1.5 border-t pt-2">
            {result.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {l.serviceName}
                  <span className="text-muted-foreground block text-xs">
                    {vnHhmm(l.startAt)} · {l.staffName}
                  </span>
                </span>
                <span className="tabular-nums">{formatVnd(l.price)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Tổng tiền dự kiến</span>
            <span className="tabular-nums">{formatVnd(result.total)}</span>
          </div>
          {result.canCancel ? (
            <Button variant="destructive" className="w-full" onClick={() => setCancelOpen(true)}>
              <CalendarX2 aria-hidden="true" />
              Hủy lịch
            </Button>
          ) : (
            (result.status === 'ChoXacNhan' || result.status === 'DaXacNhan') && (
              <p className="bg-warning/10 text-warning rounded-md px-3 py-2.5">
                Lịch còn dưới 2 giờ nên không tự hủy được. Vui lòng gọi tiệm{' '}
                <a href={`tel:${result.hotline.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-semibold underline">
                  <Phone className="size-3.5" aria-hidden="true" />
                  {result.hotline}
                </a>
              </p>
            )
          )}
        </section>
      )}

      <PublicCancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        code={result?.code ?? ''}
        phone={phoneDigits}
        onCancelled={(r) => {
          setResult(r)
          setCancelOpen(false)
        }}
      />
    </div>
  )
}

function PublicCancelDialog({
  open,
  onOpenChange,
  code,
  phone,
  onCancelled,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  code: string
  phone: string
  onCancelled: (r: PublicAppointmentDto) => void
}) {
  const cancel = usePublicCancel()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={(o) => !cancel.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hủy lịch {code}?</DialogTitle>
          <DialogDescription>Lịch sẽ chuyển sang Đã hủy, tiệm nhận được thông báo ngay.</DialogDescription>
        </DialogHeader>
        <FormField label="Lý do (không bắt buộc)">
          <Textarea rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vd bận việc đột xuất" />
        </FormField>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancel.isPending}>
            Giữ lịch
          </Button>
          <Button
            variant="danger"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate(
                { code, phone, reason: reason.trim() || null },
                { onSuccess: onCancelled, onError: (err) => setError(getErrorMessage(err)) }
              )
            }
          >
            {cancel.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Xác nhận hủy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
