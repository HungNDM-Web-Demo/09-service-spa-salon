'use client'

import { AlertTriangle, CalendarCheck2, CalendarOff, ChevronLeft, ChevronRight, Clock, StickyNote } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { MyScheduleDto } from '@/types/spa'
import { AppointmentStatusBadge } from '@/features/booking/components/SpaBadges'
import { useMySchedule } from '@/features/booking/hooks/use-spa'
import { shiftLabels } from '@/features/booking/lib/labels'
import { addDaysKey, ddmmyyyy, hhmm, isoWeekdayOf, vnHhmm, vnToday, weekdayLabel } from '@/features/booking/lib/vn-time'
import { isNoStaffProfile, NoStaffProfile } from './NoStaffProfile'

type ScheduleItem = MyScheduleDto['items'][number]

/**
 * Tab Lịch làm của KTV (UC-12 bước 2–3; FR-33, NFR-06): chuyển ngày trước/sau/hôm nay, ca làm hoặc lý do nghỉ, danh sách
 * theo giờ (giờ bắt đầu–kết thúc, khách, dịch vụ, trạng thái, ghi chú da và dị ứng). Không hiện số điện thoại khách.
 * Tối ưu điện thoại 375 px: chữ nội dung tối thiểu 14 px, nút bấm cao 44 px.
 */
export function MyScheduleDay({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const today = vnToday()
  const isToday = date === today
  const query = useMySchedule(date)
  const data = query.data?.date === date ? query.data : undefined
  const loading = query.isLoading || (query.isFetching && !data)

  return (
    <div className="space-y-3">
      <div className="bg-card flex items-center gap-1 rounded-xl border p-1.5 shadow-xs">
        <Button variant="ghost" size="icon-lg" aria-label="Ngày trước" onClick={() => onDateChange(addDaysKey(date, -1))}>
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          <p className="truncate text-base font-semibold">
            {weekdayLabel(isoWeekdayOf(date))}
            {isToday && <span className="text-primary"> · Hôm nay</span>}
          </p>
          <p className="text-muted-foreground text-sm tabular-nums">{ddmmyyyy(date)}</p>
        </div>
        <Button variant="ghost" size="icon-lg" aria-label="Ngày sau" onClick={() => onDateChange(addDaysKey(date, 1))}>
          <ChevronRight className="size-5" />
        </Button>
        {!isToday && (
          <Button variant="outline" size="lg" className="px-3" onClick={() => onDateChange(today)}>
            Hôm nay
          </Button>
        )}
      </div>

      {query.error && !data ? (
        isNoStaffProfile(query.error) ? (
          <NoStaffProfile />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="bg-card rounded-xl border" />
        )
      ) : loading || !data ? (
        <div className="space-y-3" aria-busy="true" aria-label="Đang tải lịch">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : (
        <DayContent data={data} />
      )}
    </div>
  )
}

function DayContent({ data }: { data: MyScheduleDto }) {
  const items = [...data.items].sort((a, b) => (a.startAt < b.startAt ? -1 : a.startAt > b.startAt ? 1 : 0))
  const off = !!data.offReason

  return (
    <>
      {off ? (
        <div className="border-warning/40 bg-warning/10 flex items-center gap-3 rounded-xl border px-4 py-3">
          <CalendarOff className="text-warning size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">Ngày nghỉ</p>
            <p className="text-sm">{data.offReason}</p>
          </div>
        </div>
      ) : (
        <div className="bg-card flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xs">
          <Clock className="text-primary size-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            Ca làm: <span className="font-semibold">{shiftLabels[data.shift]}</span>
            {data.shiftStart !== null && data.shiftEnd !== null && (
              <span className="tabular-nums">
                {' '}
                {hhmm(data.shiftStart)}–{hhmm(data.shiftEnd)}
              </span>
            )}
          </p>
          <span className="text-muted-foreground shrink-0 text-sm">{items.length} lịch</span>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="Không có lịch hẹn"
          description={off ? 'Bạn nghỉ ngày này.' : 'Chưa có khách đặt lịch với bạn ngày này.'}
          className="bg-card rounded-xl border shadow-xs"
          compact
        />
      ) : (
        <ol className="space-y-3" aria-label="Lịch hẹn trong ngày">
          {items.map((item) => (
            <ScheduleCard key={item.lineId} item={item} />
          ))}
        </ol>
      )}
    </>
  )
}

function ScheduleCard({ item }: { item: ScheduleItem }) {
  const active = item.status === 'DangPhucVu'
  const done = item.status === 'HoanThanh'

  return (
    <li
      className={cn(
        'bg-card flex gap-3 rounded-xl border p-4 shadow-xs',
        active && 'border-success/50 ring-success/20 ring-2',
        done && 'bg-muted/40'
      )}
    >
      <div className="w-14 shrink-0 tabular-nums">
        <p className={cn('text-lg leading-tight font-semibold', done && 'text-muted-foreground')}>{vnHhmm(item.startAt)}</p>
        <p className="text-muted-foreground text-sm">{vnHhmm(item.endAt)}</p>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <p className="min-w-0 text-base font-semibold break-words">{item.customerName}</p>
          <AppointmentStatusBadge status={item.status} className="h-7 text-sm" />
        </div>
        <p className="text-sm">{item.serviceName}</p>
        {item.customerNote && (
          <p className="border-warning/40 bg-warning/10 flex gap-2 rounded-lg border px-3 py-2 text-sm">
            <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">Lưu ý da, dị ứng:</span> {item.customerNote}
            </span>
          </p>
        )}
        {item.appointmentNote && (
          <p className="text-muted-foreground flex gap-2 text-sm">
            <StickyNote className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="text-foreground font-medium">Ghi chú lịch:</span> {item.appointmentNote}
            </span>
          </p>
        )}
        <p className="text-muted-foreground font-mono text-sm">{item.appointmentCode}</p>
      </div>
    </li>
  )
}
