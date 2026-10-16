'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Ban,
  CalendarCheck,
  CalendarX2,
  CreditCard,
  LogIn,
  MessageSquareText,
  Package,
  Pencil,
  Printer,
  ReceiptText,
  UserX,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatPhone, formatVnd } from '@/lib/format'
import type { AppointmentDetailDto, InvoiceBrief } from '@/types/spa'
import { AppointmentStatusBadge, FlaggedBadge, InvoiceStatusBadge } from '@/features/booking/components/SpaBadges'
import {
  useAppointment,
  useCheckIn,
  useConfirmAppointment,
  useNoShow,
} from '@/features/booking/hooks/use-spa'
import { messageChannelLabels, messageKindLabels, paymentMethodLabels, sourceLabels } from '@/features/booking/lib/labels'
import { cancelReasonLabel } from '@/features/booking/lib/rules'
import { ddmmyyyy, isoWeekdayOf, vnHhmm, vnHhmmDate, weekdayLabel } from '@/features/booking/lib/vn-time'
import { AppointmentDialog, type AppointmentDialogTarget } from '../components/AppointmentDialog'
import { CancelAppointmentDialog } from '../components/CancelAppointmentDialog'
import { CheckoutDialog } from '../components/CheckoutDialog'
import { CancelInvoiceDialog } from '@/features/invoices/components/CancelInvoiceDialog'

/** Chi tiết lịch hẹn (SCR-04): nút theo trạng thái (07 §3.9), dòng dịch vụ, khách, hóa đơn, tin nhắn giả lập. */
export function AppointmentDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const query = useAppointment(id)

  if (query.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  if (query.error || !query.data)
    return <ErrorState error={query.error} title="Không mở được lịch hẹn" onRetry={() => query.refetch()} />

  return <Detail a={query.data} onBack={() => (window.history.length > 1 ? router.back() : router.push(routePath.appointments))} />
}

function Detail({ a, onBack }: { a: AppointmentDetailDto; onBack: () => void }) {
  const { can } = usePermissions()
  const confirm = useConfirmAppointment()
  const checkIn = useCheckIn()
  const noShow = useNoShow()
  const [edit, setEdit] = useState<AppointmentDialogTarget | null>(null)
  const [cancelMode, setCancelMode] = useState<'cancel' | 'reject' | null>(null)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)
  const [noShowOpen, setNoShowOpen] = useState(false)
  const [cancelInvoice, setCancelInvoice] = useState<InvoiceBrief | null>(null)
  const busy = confirm.isPending || checkIn.isPending || noShow.isPending
  const act = a.actions
  const lines = [...a.lines].sort((x, y) => x.sortOrder - y.sortOrder)
  const total = lines.reduce((s, l) => s + l.price, 0)

  const run = (fn: typeof confirm, message: string) =>
    fn.mutate(a.id, { onSuccess: () => toast.success(message), onError: (err) => toast.error(getErrorMessage(err)) })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" aria-label="Quay lại" onClick={onBack}>
            <ArrowLeft />
          </Button>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight tabular-nums">{a.code}</h1>
              <AppointmentStatusBadge status={a.status} />
              {a.isLate && <span className="bg-destructive text-destructive-foreground rounded px-1.5 py-0.5 text-xs font-semibold">Trễ</span>}
              {a.pendingOverdue && <span className="bg-cta/15 text-cta rounded px-1.5 py-0.5 text-xs font-semibold">Chờ quá 30 phút</span>}
            </div>
            <p className="text-muted-foreground text-sm tabular-nums">
              {weekdayLabel(isoWeekdayOf(a.date))}, {ddmmyyyy(a.date)} · {vnHhmm(a.startAt)}–{vnHhmm(a.endAt)} · {sourceLabels[a.source]}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {act.canConfirm && (
            <Button onClick={() => run(confirm, `Đã xác nhận lịch ${a.code}, đã gửi tin xác nhận (giả lập)`)} disabled={busy}>
              <CalendarCheck aria-hidden="true" />
              Xác nhận
            </Button>
          )}
          {act.canCheckIn && (
            <Button onClick={() => run(checkIn, `Khách đã tới, lịch ${a.code} đang phục vụ`)} disabled={busy}>
              <LogIn aria-hidden="true" />
              Check-in
            </Button>
          )}
          {act.canCheckout && (
            <Button variant="cta" onClick={() => setCheckoutId(a.id)} disabled={busy}>
              <CreditCard aria-hidden="true" />
              Thanh toán
            </Button>
          )}
          {act.canEdit && (
            <Button variant="outline" onClick={() => setEdit({ mode: 'edit', appointment: a })} disabled={busy}>
              <Pencil aria-hidden="true" />
              {a.status === 'DangPhucVu' ? 'Thêm, bỏ dịch vụ' : 'Sửa lịch'}
            </Button>
          )}
          {act.canNoShow && (
            <Button variant="outline" onClick={() => setNoShowOpen(true)} disabled={busy}>
              <UserX aria-hidden="true" />
              Không đến
            </Button>
          )}
          {act.canReject && (
            <Button variant="destructive" onClick={() => setCancelMode('reject')} disabled={busy}>
              <XCircle aria-hidden="true" />
              Từ chối
            </Button>
          )}
          {act.canCancel && !act.canReject && (
            <Button variant="destructive" onClick={() => setCancelMode('cancel')} disabled={busy}>
              <CalendarX2 aria-hidden="true" />
              Hủy lịch
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Card title="Dịch vụ">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr className="border-b">
                    <th className="px-4 py-2 font-medium">Dịch vụ</th>
                    <th className="px-4 py-2 font-medium">Kỹ thuật viên</th>
                    <th className="px-4 py-2 font-medium">Giờ</th>
                    <th className="px-4 py-2 text-right font-medium">Giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2.5 font-medium">{l.serviceName}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: l.staffColor }} aria-hidden="true" />
                          {l.staffName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {vnHhmm(l.startAt)}–{vnHhmm(l.endAt)}{' '}
                        <span className="text-muted-foreground">({l.durationMinutes}′{l.cleanupMinutes ? ` + ${l.cleanupMinutes}′ dọn` : ''})</span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatVnd(l.price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="px-4 py-2.5" colSpan={3}>
                      Tạm tính (chưa trừ gói, giảm giá)
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatVnd(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {a.note && <p className="text-muted-foreground border-t px-4 py-2.5 text-sm">Ghi chú: {a.note}</p>}
          </Card>

          <Card title="Hóa đơn" icon={ReceiptText}>
            {a.invoices.length === 0 ? (
              <p className="text-muted-foreground px-4 py-3 text-sm">Chưa có hóa đơn. Thanh toán khi lịch đang phục vụ.</p>
            ) : (
              <ul className="divide-y">
                {a.invoices.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                    <span className="font-medium tabular-nums">{inv.code}</span>
                    <span className="text-muted-foreground tabular-nums">{vnHhmmDate(inv.paidAt)}</span>
                    <span>{paymentMethodLabels[inv.method]}</span>
                    <span className="font-semibold tabular-nums">{formatVnd(inv.total)}</span>
                    <InvoiceStatusBadge status={inv.status} />
                    <span className="flex-1" />
                    <Button asChild variant="outline" size="sm">
                      <Link href={routePath.invoicePrint(inv.id)}>
                        <Printer aria-hidden="true" />
                        In
                      </Link>
                    </Button>
                    {can(permissions.invoices.cancel) && inv.status === 'DaThanhToan' && (
                      <CancelInvoiceButton invoice={inv} onClick={() => setCancelInvoice(inv)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Tin nhắn đã gửi (giả lập)" icon={MessageSquareText}>
            {a.messages.length === 0 ? (
              <p className="text-muted-foreground px-4 py-3 text-sm">Chưa có tin nhắn.</p>
            ) : (
              <ol className="divide-y">
                {[...a.messages]
                  .sort((x, y) => (x.sentAt < y.sentAt ? 1 : -1))
                  .map((m) => (
                    <li key={m.id} className="space-y-1 px-4 py-3 text-sm">
                      <p className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
                        <span className="text-foreground font-medium">{messageKindLabels[m.kind]}</span>
                        <span>qua {messageChannelLabels[m.channel]}</span>
                        <span className="tabular-nums">{vnHhmmDate(m.sentAt)}</span>
                      </p>
                      <p>{m.content}</p>
                    </li>
                  ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Khách hàng">
            <div className="space-y-2 px-4 py-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{a.customer.fullName}</span>
                {a.customer.isFlagged && <FlaggedBadge count={a.customer.noShowCount90} />}
              </p>
              <p className="text-muted-foreground tabular-nums">
                {a.customer.code} · {formatPhone(a.customer.phone)}
              </p>
              {a.customer.note && <p className="bg-warning/10 rounded-md px-2.5 py-1.5">{a.customer.note}</p>}
              <dl className="grid grid-cols-2 gap-2 pt-1">
                <Stat label="Tổng chi tiêu" value={formatVnd(a.customer.totalSpent)} />
                <Stat label="Lượt đã làm" value={String(a.customer.visitCount)} />
                <Stat label="Không đến (90 ngày)" value={String(a.customer.noShowCount90)} />
                <Stat label="Gói đang dùng" value={String(a.customer.activePackageCount)} />
              </dl>
            </div>
            {a.packages.filter((p) => p.status === 'DangDung').length > 0 && (
              <ul className="divide-y border-t">
                {a.packages
                  .filter((p) => p.status === 'DangDung')
                  .map((p) => (
                    <li key={p.id} className="flex items-start gap-2 px-4 py-2.5 text-sm">
                      <Package className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-medium">{p.packageName}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {p.code} · còn {p.remaining}/{p.totalSessions} buổi · hạn {ddmmyyyy(p.expiryDate)}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <Card title="Lịch sử">
            <dl className="space-y-2 px-4 py-3 text-sm">
              <Timeline label="Tạo lịch" at={a.createdAt} by={a.createdByName} />
              {a.confirmedAt && <Timeline label="Xác nhận" at={a.confirmedAt} by={a.confirmedByName} />}
              {a.checkedInAt && <Timeline label="Check-in" at={a.checkedInAt} by={a.checkedInByName} />}
              {a.completedAt && <Timeline label="Hoàn thành" at={a.completedAt} />}
              {a.noShowAt && <Timeline label="Không đến" at={a.noShowAt} by={a.noShowByName} />}
              {a.cancelledAt && (
                <Timeline
                  label="Hủy"
                  at={a.cancelledAt}
                  by={a.cancelledByName}
                  extra={a.cancelReason ? `${cancelReasonLabel(a.cancelReason)}${a.cancelNote ? `: ${a.cancelNote}` : ''}` : null}
                />
              )}
            </dl>
          </Card>
        </div>
      </div>

      <AppointmentDialog target={edit} onOpenChange={(o) => !o && setEdit(null)} />
      <CancelAppointmentDialog appointment={a} mode={cancelMode} onOpenChange={(o) => !o && setCancelMode(null)} />
      <CheckoutDialog appointmentId={checkoutId} onOpenChange={(o) => !o && setCheckoutId(null)} />
      <ConfirmDialog
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
        title={`Ghi nhận khách không đến lịch ${a.code}?`}
        description="Chỗ của kỹ thuật viên trống lại; số lần không đến của khách tăng 1 (từ 3 lần trong 90 ngày khách bị gắn nhãn Hay bỏ hẹn)."
        confirmText="Ghi nhận không đến"
        variant="destructive"
        icon={UserX}
        loading={noShow.isPending}
        onConfirm={() =>
          new Promise<void>((resolve, reject) =>
            noShow.mutate(a.id, {
              onSuccess: () => {
                toast.success(`Đã ghi nhận lịch ${a.code} không đến`)
                resolve()
              },
              onError: (err) => {
                toast.error(getErrorMessage(err))
                reject(err)
              },
            })
          )
        }
      />
      <CancelInvoiceDialog invoice={cancelInvoice} onOpenChange={(o) => !o && setCancelInvoice(null)} />
    </div>
  )
}

function CancelInvoiceButton({ invoice, onClick }: { invoice: InvoiceBrief; onClick: () => void }) {
  if (invoice.canCancel)
    return (
      <Button variant="destructive" size="sm" onClick={onClick}>
        <Ban aria-hidden="true" />
        Hủy hóa đơn
      </Button>
    )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button variant="destructive" size="sm" disabled>
            <Ban aria-hidden="true" />
            Hủy hóa đơn
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{invoice.cancelBlockedReason ?? 'Không hủy được hóa đơn này'}</TooltipContent>
    </Tooltip>
  )
}

function Card({ title, icon: Icon, children }: { title: string; icon?: typeof Package; children: React.ReactNode }) {
  return (
    <section className="bg-card overflow-hidden rounded-xl border shadow-xs">
      <h2 className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
        {Icon && <Icon className="text-muted-foreground size-4" aria-hidden="true" />}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-md px-2.5 py-1.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function Timeline({ label, at, by, extra }: { label: string; at: string; by?: string | null; extra?: string | null }) {
  return (
    <div className="flex gap-3">
      <dt className="text-muted-foreground w-24 shrink-0">{label}</dt>
      <dd className="min-w-0">
        <span className="tabular-nums">{vnHhmmDate(at)}</span>
        {by && <span className="text-muted-foreground"> · {by}</span>}
        {extra && <p className="text-muted-foreground">{extra}</p>}
      </dd>
    </div>
  )
}
