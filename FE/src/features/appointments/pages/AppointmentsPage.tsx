'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Store } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { AppointmentCardDto, AppointmentStatus } from '@/types/spa'
import { useAppointments, useBoard, useMoveLine } from '@/features/booking/hooks/use-spa'
import { appointmentStatusLabels } from '@/features/booking/lib/labels'
import { bookingRules } from '@/features/booking/lib/rules'
import { addDaysKey, ddmmyyyy, hhmm, isoWeekdayOf, vnHhmm, vnIso, vnNow, vnToday, weekdayLabel } from '@/features/booking/lib/vn-time'
import { AppointmentBoard, type BoardMove } from '../components/AppointmentBoard'
import { AppointmentDialog, type AppointmentDialogTarget } from '../components/AppointmentDialog'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Lịch hẹn (SCR-02): lưới theo KTV, `?date=` chọn ngày, `?pending=1` lọc lịch chờ xác nhận; tự làm mới mỗi 30 giây. */
export function AppointmentsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { can } = usePermissions()
  const today = vnToday()
  const dateParam = params.get('date')
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : today
  const pendingOnly = params.get('pending') === '1'
  const isToday = date === today
  const isPast = date < today

  const board = useBoard(date)
  const move = useMoveLine()
  const pendingList = useAppointments(
    { status: 'ChoXacNhan', from: today, page: 1, pageSize: 50, sortBy: 'startAt', sortDir: 'asc' },
    pendingOnly
  )
  const canCreate = can(permissions.appointments.create)
  // ?new=1 (nút "Tạo lịch hẹn" ở Tổng quan) mở sẵn hộp tạo lịch
  const [dialog, setDialog] = useState<AppointmentDialogTarget | null>(() =>
    params.get('new') === '1' && canCreate ? { mode: 'create', date: isPast ? today : date } : null
  )
  const canMove = can(permissions.appointments.update)

  const setQuery = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    if (next.get('date') === today) next.delete('date')
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const counts = useMemo(() => {
    const map = new Map<AppointmentStatus, number>()
    for (const a of board.data?.appointments ?? []) map.set(a.status, (map.get(a.status) ?? 0) + 1)
    return map
  }, [board.data])

  const openDetail = (a: { id: string }) => router.push(routePath.appointmentDetail(a.id))

  const onMove = ({ appointment, line, staffId, start }: BoardMove) => {
    move.mutate(
      { id: appointment.id, lineId: line.id, input: { staffMemberId: staffId, startAt: vnIso(date, start) } },
      {
        onSuccess: (a) =>
          toast.success(
            `Đã chuyển ${line.serviceName} sang ${hhmm(start)}${a.status === 'DangPhucVu' ? '' : ', đã gửi tin đổi lịch (giả lập)'}`
          ),
        onError: (err) => toast.error(`Không đổi được giờ: ${getErrorMessage(err)}`),
      }
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lịch hẹn"
        icon={CalendarDays}
        description={`${weekdayLabel(isoWeekdayOf(date))}, ${ddmmyyyy(date)}${isToday ? ' (hôm nay)' : ''}`}
        actions={
          canCreate && (
            <Button onClick={() => setDialog({ mode: 'create', date: isPast ? today : date })}>
              <Plus aria-hidden="true" />
              Tạo lịch hẹn
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Ngày trước" onClick={() => setQuery({ date: addDaysKey(date, -1) })}>
            <ChevronLeft />
          </Button>
          <Input
            type="date"
            value={date}
            aria-label="Chọn ngày"
            onChange={(e) => e.target.value && setQuery({ date: e.target.value })}
            className="w-40"
          />
          <Button variant="outline" size="icon" aria-label="Ngày sau" onClick={() => setQuery({ date: addDaysKey(date, 1) })}>
            <ChevronRight />
          </Button>
          {!isToday && (
            <Button variant="ghost" onClick={() => setQuery({ date: null })}>
              Hôm nay
            </Button>
          )}
        </div>
        <Button
          variant={pendingOnly ? 'default' : 'outline'}
          aria-pressed={pendingOnly}
          onClick={() => setQuery({ pending: pendingOnly ? null : '1' })}
        >
          <Clock aria-hidden="true" />
          Chờ xác nhận
        </Button>
        <div className="text-muted-foreground ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {(['ChoXacNhan', 'DaXacNhan', 'DangPhucVu', 'HoanThanh'] as AppointmentStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'size-3 rounded-sm border',
                  s === 'ChoXacNhan' && 'border-pending bg-pending/20 border-dashed',
                  s === 'DaXacNhan' && 'bg-card border-l-primary border-l-4',
                  s === 'DangPhucVu' && 'border-success bg-success/20',
                  s === 'HoanThanh' && 'bg-muted'
                )}
                aria-hidden="true"
              />
              {appointmentStatusLabels[s].label} <b className="text-foreground tabular-nums">{counts.get(s) ?? 0}</b>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="border-cta bg-cta/30 size-3 rounded-sm border border-dashed" aria-hidden="true" />
            Chờ quá 30 phút
          </span>
        </div>
      </div>

      {pendingOnly && <PendingPanel items={pendingList.data?.items} loading={pendingList.isLoading} onOpen={openDetail} />}

      {board.isLoading ? (
        <Skeleton className="h-[480px] w-full rounded-xl" />
      ) : board.error ? (
        <ErrorState error={board.error} onRetry={() => board.refetch()} />
      ) : board.data ? (
        <>
          {board.data.shopClosedReason && (
            <p className="bg-warning/10 text-warning flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium">
              <Store className="size-4" aria-hidden="true" />
              Tiệm nghỉ ngày {ddmmyyyy(date)}: {board.data.shopClosedReason}
            </p>
          )}
          {board.data.technicians.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Không có kỹ thuật viên làm ngày này"
              description="Chọn ngày khác hoặc xếp ca ở trang Nhân viên."
            />
          ) : (
            <AppointmentBoard
              board={board.data}
              isToday={isToday}
              isPast={isPast}
              canCreate={canCreate && !board.data.shopClosedReason}
              canMove={canMove}
              highlightPending={pendingOnly}
              onSlotClick={(staffId, start) => setDialog({ mode: 'create', date, staffId, start })}
              onOpen={(a: AppointmentCardDto) => openDetail(a)}
              onMove={onMove}
            />
          )}
        </>
      ) : null}

      <AppointmentDialog
        target={dialog}
        onOpenChange={(o) => {
          if (o) return
          setDialog(null)
          if (params.get('new')) setQuery({ new: null })
        }}
      />
    </div>
  )
}

/** Chờ xác nhận quá 30 phút (BR-08) */
const overdue = (createdAt: string) => vnNow() - new Date(createdAt).getTime() > bookingRules.pendingOverdueMinutes * 60_000

function PendingPanel({
  items,
  loading,
  onOpen,
}: {
  items: { id: string; code: string; date: string; startAt: string; customerName: string; services: string; staffNames: string; createdAt: string }[] | undefined
  loading: boolean
  onOpen: (a: { id: string }) => void
}) {
  return (
    <section className="bg-card rounded-xl border shadow-xs" aria-labelledby="pending-title">
      <h2 id="pending-title" className="border-b px-4 py-2.5 text-sm font-semibold">
        Lịch online chờ xác nhận {items ? `(${items.length})` : ''}
      </h2>
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : !items?.length ? (
        <p className="text-muted-foreground px-4 py-3 text-sm">Không còn lịch chờ xác nhận.</p>
      ) : (
        <ul className="divide-y">
          {items.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onOpen(a)}
                className={cn(
                  'hover:bg-muted/60 flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-left text-sm',
                  overdue(a.createdAt) && 'bg-cta/10 hover:bg-cta/15'
                )}
              >
                <span className="text-primary font-medium tabular-nums">{a.code}</span>
                <span className="tabular-nums">
                  {vnHhmm(a.startAt)} {ddmmyyyy(a.date)}
                </span>
                <span className="font-medium">{a.customerName}</span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  {a.services} · {a.staffNames}
                </span>
                <span className={cn('text-xs', overdue(a.createdAt) ? 'text-cta font-medium' : 'text-muted-foreground')}>
                  {overdue(a.createdAt) ? 'Chờ quá 30 phút, đặt' : 'Đặt'} lúc {vnHhmm(a.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
