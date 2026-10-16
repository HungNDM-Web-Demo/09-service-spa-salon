'use client'

import { HandCoins } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatVnd } from '@/lib/format'
import type { CommissionItemDto, MyCommissionsDto } from '@/types/spa'
import { PeriodStatusBadge } from '@/features/booking/components/SpaBadges'
import { useMyCommissions } from '@/features/booking/hooks/use-spa'
import { commissionKindLabels } from '@/features/booking/lib/labels'
import { ddmmyyyy, isoWeekdayOf, vnDateKey, vnHhmm, weekdayLabel } from '@/features/booking/lib/vn-time'
import { monthDisplay, rateText } from '../lib/month'
import { MonthNavigator } from './MonthNavigator'
import { isNoStaffProfile, NoStaffProfile } from './NoStaffProfile'

/**
 * Tab Hoa hồng của KTV (UC-12 bước 4; FR-33): tổng hoa hồng tháng (tạm tính tới khi chủ tiệm chốt), tách dịch vụ và
 * bán gói, danh sách từng khoản của chính KTV gom theo ngày.
 */
export function MyCommissionsPanel({ month, onMonthChange }: { month: string; onMonthChange: (month: string) => void }) {
  const query = useMyCommissions(month)
  const data = query.data

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-xl border p-1.5 shadow-xs">
        <MonthNavigator value={month} onChange={onMonthChange} />
      </div>

      {query.error ? (
        isNoStaffProfile(query.error) ? (
          <NoStaffProfile />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="bg-card rounded-xl border" />
        )
      ) : !data ? (
        <div className="space-y-3" aria-busy="true" aria-label="Đang tải hoa hồng">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : (
        <Content data={data} />
      )}
    </div>
  )
}

function Content({ data }: { data: MyCommissionsDto }) {
  const days = groupByDay(data.items)

  return (
    <>
      <section className="bg-card space-y-3 rounded-xl border p-4 shadow-xs" aria-label="Tổng hoa hồng tháng">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">Hoa hồng tháng {monthDisplay(data.month)}</p>
          <PeriodStatusBadge status={data.status} />
        </div>
        <p className="text-primary text-3xl font-semibold tracking-tight tabular-nums">{formatVnd(data.total)}</p>
        <dl className="grid grid-cols-2 gap-2">
          <div className="bg-muted/60 rounded-lg px-3 py-2">
            <dt className="text-muted-foreground text-sm">Dịch vụ</dt>
            <dd className="font-semibold tabular-nums">{formatVnd(data.serviceCommission)}</dd>
          </div>
          <div className="bg-muted/60 rounded-lg px-3 py-2">
            <dt className="text-muted-foreground text-sm">Bán gói</dt>
            <dd className="font-semibold tabular-nums">{formatVnd(data.packageCommission)}</dd>
          </div>
        </dl>
        {data.status === 'TamTinh' && (
          <p className="text-muted-foreground text-sm">Số tạm tính, có thể đổi khi hóa đơn bị hủy, tới khi chủ tiệm chốt bảng.</p>
        )}
      </section>

      {days.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Chưa có khoản hoa hồng"
          description={`Tháng ${monthDisplay(data.month)} bạn chưa có dịch vụ hoặc gói nào được thanh toán.`}
          className="bg-card rounded-xl border shadow-xs"
          compact
        />
      ) : (
        <div className="space-y-3">
          {days.map((d) => (
            <section key={d.date} className="bg-card overflow-hidden rounded-xl border shadow-xs" aria-label={`Ngày ${ddmmyyyy(d.date)}`}>
              <header className="bg-muted/50 flex items-center justify-between gap-2 border-b px-4 py-2 text-sm">
                <span className="font-medium">
                  {weekdayLabel(isoWeekdayOf(d.date))}, {ddmmyyyy(d.date)}
                </span>
                <span className="font-semibold tabular-nums">{formatVnd(d.total)}</span>
              </header>
              <ul className="divide-y">
                {d.items.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium break-words">{c.description}</p>
                      <p className="text-muted-foreground text-sm">
                        {commissionKindLabels[c.kind]} · {c.customerName}
                      </p>
                      <p className="text-muted-foreground text-sm tabular-nums">
                        {vnHhmm(c.earnedAt)} · {c.invoiceCode}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-success font-semibold tabular-nums">+{formatVnd(c.amount)}</p>
                      <p className="text-muted-foreground text-sm tabular-nums">
                        {c.rateType === 'PhanTram' ? `${rateText(c.rateType, c.rateValue)} × ${formatVnd(c.baseAmount)}` : 'Cố định'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

/** Gom khoản theo ngày thanh toán (giờ Việt Nam), ngày mới nhất trước */
function groupByDay(items: CommissionItemDto[]) {
  const map = new Map<string, { date: string; total: number; items: CommissionItemDto[] }>()
  for (const c of [...items].sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1))) {
    const date = vnDateKey(c.earnedAt)
    const g = map.get(date) ?? { date, total: 0, items: [] }
    g.items.push(c)
    g.total += c.amount
    map.set(date, g)
  }
  return [...map.values()]
}
