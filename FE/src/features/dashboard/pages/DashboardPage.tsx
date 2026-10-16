'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Clock,
  Globe,
  Plus,
  Sparkles,
  Store,
  UserPlus,
  UserX,
  Wallet,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardCard } from '@/types/spa'
import { AppointmentStatusBadge } from '@/features/booking/components/SpaBadges'
import { useDashboardToday } from '@/features/booking/hooks/use-spa'
import { ddmmyyyy, isoWeekdayOf, vnDateKey, vnHhmm, vnNow, vnParts, vnToday, weekdayLabel } from '@/features/booking/lib/vn-time'

const vnDdMm = (iso: string) => ddmmyyyy(vnDateKey(iso)).slice(0, 5)
import { KpiCard } from '../components/KpiCard'

function greeting(hour: number) {
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 13) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

/** Tổng quan (SCR-01, UC-14): thẻ số hôm nay, lịch 2 giờ tới, lịch online chờ xác nhận; tiệm nghỉ thì hiện lịch ngày mai. */
export function DashboardPage() {
  const router = useRouter()
  const { user, can } = usePermissions()
  const query = useDashboardToday()
  const data = query.data
  const firstName = user?.fullName.split(' ').slice(-2).join(' ')
  const hour = vnParts(vnNow()).hour
  const openDetail = (c: DashboardCard) => router.push(routePath.appointmentDetail(c.id))

  return (
    <PermissionGuard permission={permissions.dashboard.view} redirect>
      <div className="space-y-6">
        <section className="bg-card relative overflow-hidden rounded-2xl border p-6 shadow-xs">
          <div className="bg-primary/10 pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">
                {data ? `${weekdayLabel(isoWeekdayOf(data.date))}, ${ddmmyyyy(data.date)}` : ' '}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {greeting(hour)}, {firstName}!
              </h1>
              <p className="text-muted-foreground text-sm">Tình hình lịch hẹn và thực thu của tiệm hôm nay.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={routePath.appointments}>
                  <CalendarDays aria-hidden="true" />
                  Mở lưới lịch hẹn
                </Link>
              </Button>
              {can(permissions.appointments.create) && (
                <Button asChild>
                  <Link href={`${routePath.appointments}?new=1`}>
                    <Plus aria-hidden="true" />
                    Tạo lịch hẹn
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <>
            {data?.shopClosedReason && (
              <p className="bg-warning/10 text-warning flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium">
                <Store className="size-4" aria-hidden="true" />
                Hôm nay tiệm nghỉ ({data.shopClosedReason}). Danh sách bên dưới là lịch ngày mai.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="Lịch hôm nay" value={data?.counts.total ?? 0} icon={CalendarDays} isLoading={query.isLoading} />
              <Link
                href={`${routePath.appointments}?pending=1`}
                className="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
                aria-label="Xem lịch chờ xác nhận"
              >
                <KpiCard
                  label="Chờ xác nhận"
                  value={data?.pendingOnline.length ?? 0}
                  icon={Clock}
                  isLoading={query.isLoading}
                  className={cn('hover:border-warning/60 h-full transition-colors', (data?.pendingOnline.length ?? 0) > 0 && 'border-warning/50')}
                />
              </Link>
              <KpiCard label="Đang phục vụ" value={data?.counts.inService ?? 0} icon={Sparkles} isLoading={query.isLoading} />
              <KpiCard label="Hoàn thành" value={data?.counts.completed ?? 0} icon={CalendarCheck2} isLoading={query.isLoading} />
              <KpiCard label="Không đến" value={data?.counts.noShow ?? 0} icon={UserX} isLoading={query.isLoading} />
              <KpiCard label="Khách mới" value={data?.newCustomersToday ?? 0} icon={UserPlus} isLoading={query.isLoading} />
            </div>

            <div className="bg-card flex flex-wrap items-center gap-4 rounded-xl border p-5 shadow-xs">
              <span className="bg-success/12 text-success flex size-11 items-center justify-center rounded-xl">
                <Wallet className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-muted-foreground text-sm">Thực thu hôm nay (dịch vụ lẻ + bán gói, đã trừ giảm giá)</p>
                {query.isLoading ? (
                  <Skeleton className="mt-1 h-8 w-40" />
                ) : (
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatVnd(data?.revenueToday ?? 0)}</p>
                )}
              </div>
              {can(permissions.reports.view) && (
                <Button asChild variant="ghost" className="ml-auto">
                  <Link href={routePath.reports}>
                    Xem báo cáo
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              {data?.shopClosedReason ? (
                <CardList
                  title="Lịch ngày mai"
                  icon={CalendarClock}
                  items={data.tomorrow}
                  loading={query.isLoading}
                  empty="Ngày mai chưa có lịch hẹn."
                  onOpen={openDetail}
                />
              ) : (
                <CardList
                  title="Sắp tới trong 2 giờ"
                  icon={CalendarClock}
                  items={data?.upcoming}
                  loading={query.isLoading}
                  empty="Không có lịch nào bắt đầu trong 2 giờ tới."
                  onOpen={openDetail}
                />
              )}
              <CardList
                title="Lịch online chờ xác nhận"
                icon={Globe}
                items={data?.pendingOnline}
                loading={query.isLoading}
                empty="Không còn lịch online chờ xác nhận."
                onOpen={openDetail}
                footer={
                  (data?.pendingOnline.length ?? 0) > 0 ? (
                    <Link href={`${routePath.appointments}?pending=1`} className="text-primary text-sm font-medium hover:underline">
                      Xem trên lưới lịch hẹn
                    </Link>
                  ) : null
                }
              />
            </div>
          </>
        )}
      </div>
    </PermissionGuard>
  )
}

function CardList({
  title,
  icon: Icon,
  items,
  loading,
  empty,
  onOpen,
  footer,
}: {
  title: string
  icon: typeof Clock
  items: DashboardCard[] | undefined
  loading: boolean
  empty: string
  onOpen: (c: DashboardCard) => void
  footer?: React.ReactNode
}) {
  return (
    <section className="bg-card overflow-hidden rounded-xl border shadow-xs">
      <h2 className="flex items-center gap-2 border-b px-5 py-3 font-semibold">
        <Icon className="text-muted-foreground size-4" aria-hidden="true" />
        {title}
        {items && <span className="text-muted-foreground text-sm font-normal">({items.length})</span>}
      </h2>
      {loading ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : !items?.length ? (
        <EmptyState compact icon={Icon} title={empty} />
      ) : (
        <ul className="divide-y">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpen(c)}
                className={cn(
                  'hover:bg-muted/60 flex w-full cursor-pointer items-center gap-4 px-5 py-3 text-left transition-colors',
                  c.pendingOverdue && 'bg-cta/10 hover:bg-cta/15'
                )}
              >
                <div className="w-14 shrink-0 text-center">
                  <p className="font-semibold tabular-nums">{vnHhmm(c.startAt)}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {vnDateKey(c.startAt) === vnToday() ? vnHhmm(c.endAt) : vnDdMm(c.startAt)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {c.customerName}
                    {c.isLate && <span className="bg-destructive text-destructive-foreground rounded px-1 text-[0.6875rem] font-semibold">Trễ</span>}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    {c.services} · {c.staffNames}
                  </p>
                  {c.pendingOverdue && <p className="text-cta text-xs font-medium">Chờ quá 30 phút, đặt lúc {vnHhmm(c.createdAt)}</p>}
                </div>
                <AppointmentStatusBadge status={c.status} className="hidden sm:inline-flex" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="border-t px-5 py-2.5">{footer}</div>}
    </section>
  )
}
