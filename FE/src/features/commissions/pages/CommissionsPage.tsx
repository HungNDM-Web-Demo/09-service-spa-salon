'use client'

import { useState } from 'react'
import { BadgeCheck, ChevronRight, HandCoins, Lock, PackageCheck, Sparkles, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionRowDto, CommissionSheetDto } from '@/types/spa'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import { PeriodStatusBadge } from '@/features/booking/components/SpaBadges'
import { useCloseCommissions, useCommissionSheet, usePayCommissions } from '@/features/booking/hooks/use-spa'
import { vnHhmmDate } from '@/features/booking/lib/vn-time'
import { CommissionItemsSheet, type CommissionSheetTarget } from '../components/CommissionItemsSheet'
import { MonthNavigator } from '../components/MonthNavigator'
import { currentMonth, monthDisplay } from '../lib/month'

/**
 * Hoa hồng (SCR-12, UC-11; FR-31, FR-32, BR-25): bảng tháng mỗi nhân viên một dòng và dòng tổng cộng; bấm dòng mở chi
 * tiết từng khoản. Chốt bảng từ ngày 01 tháng sau (nút khóa kèm lý do khi chưa được chốt), sau đó đánh dấu đã chi trả.
 */
export function CommissionsPage() {
  const { can } = usePermissions()
  const [month, setMonth] = useState(currentMonth)
  const sheet = useCommissionSheet(month)
  const close = useCloseCommissions()
  const pay = usePayCommissions()
  const [target, setTarget] = useState<CommissionSheetTarget | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  // Giữ loại thao tác khi hộp thoại đóng để chữ không nháy trong lúc đóng
  const [confirmKind, setConfirmKind] = useState<'close' | 'pay'>('close')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const data = sheet.data
  // Dữ liệu tháng cũ còn hiện trong lúc tải tháng mới: khóa nút để không chốt nhầm tháng
  const stale = sheet.isPlaceholderData || data?.month !== month
  const canManage = can(permissions.commissions.close)
  const busy = close.isPending || pay.isPending

  const openRow = (row: CommissionRowDto) => {
    if (!row.staffMemberId) return
    setTarget({ month, row })
    setDetailOpen(true)
  }

  const askConfirm = (kind: 'close' | 'pay') => {
    setConfirmKind(kind)
    setConfirmOpen(true)
  }

  const runConfirm = async () => {
    const action = confirmKind === 'close' ? close : pay
    try {
      await action.mutateAsync(month)
      toast.success(
        confirmKind === 'close'
          ? `Đã chốt bảng hoa hồng tháng ${monthDisplay(month)}`
          : `Đã đánh dấu chi trả hoa hồng tháng ${monthDisplay(month)}`
      )
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const actions =
    data && canManage && !stale ? (
      data.status === 'TamTinh' ? (
        data.canClose ? (
          <Button onClick={() => askConfirm('close')} disabled={busy}>
            <Lock aria-hidden="true" />
            Chốt bảng hoa hồng
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="rounded-md">
                <Button disabled>
                  <Lock aria-hidden="true" />
                  Chốt bảng hoa hồng
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{data.closeBlockedReason ?? 'Chưa chốt được bảng tháng này'}</TooltipContent>
          </Tooltip>
        )
      ) : data.status === 'DaChot' ? (
        <Button variant="cta" onClick={() => askConfirm('pay')} disabled={busy}>
          <BadgeCheck aria-hidden="true" />
          Đánh dấu đã chi trả
        </Button>
      ) : null
    ) : null

  return (
    <PermissionGuard permission={permissions.commissions.view} redirect>
      <div className="space-y-5">
        <PageHeader
          title="Hoa hồng"
          icon={HandCoins}
          description="Hoa hồng tính vào tháng của ngày thanh toán. Chốt bảng từ ngày 01 tháng sau để trả lương; đã chốt thì không đổi nữa."
          actions={actions}
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <MonthNavigator value={month} onChange={setMonth} picker />
          {data && <PeriodInfo data={data} showBlocked={canManage} className={cn(stale && 'opacity-60')} />}
        </div>

        {sheet.error && !data ? (
          <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
        ) : (
          <div className={cn('space-y-5 transition-opacity', stale && 'opacity-60')}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Tổng hoa hồng" value={formatVnd(data?.totals.total ?? 0)} icon={Wallet} isLoading={!data} />
              <KpiCard label="Hoa hồng dịch vụ" value={formatVnd(data?.totals.serviceCommission ?? 0)} icon={Sparkles} isLoading={!data} />
              <KpiCard label="Hoa hồng bán gói" value={formatVnd(data?.totals.packageCommission ?? 0)} icon={PackageCheck} isLoading={!data} />
              <KpiCard label="Doanh số tính hoa hồng" value={formatVnd(data?.totals.serviceBase ?? 0)} icon={HandCoins} isLoading={!data} />
            </div>
            {!data ? (
              <Skeleton className="h-80 w-full rounded-xl" />
            ) : data.rows.length === 0 ? (
              <Card>
                <EmptyState
                  icon={HandCoins}
                  title={`Tháng ${monthDisplay(data.month)} chưa có hoa hồng`}
                  description="Hoa hồng tự ghi khi hóa đơn thanh toán. Chọn tháng khác để xem bảng cũ."
                />
              </Card>
            ) : (
              <SheetTable data={data} onOpen={openRow} />
            )}
          </div>
        )}
      </div>

      <CommissionItemsSheet target={target} open={detailOpen} onOpenChange={setDetailOpen} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={confirmKind === 'close' ? Lock : BadgeCheck}
        title={confirmKind === 'close' ? `Chốt bảng hoa hồng tháng ${monthDisplay(month)}?` : `Đánh dấu đã chi trả tháng ${monthDisplay(month)}?`}
        description={
          confirmKind === 'close'
            ? `Tổng ${formatVnd(data?.totals.total ?? 0)} cho ${data?.rows.length ?? 0} nhân viên. Sau khi chốt, hoa hồng tháng này không đổi nữa và hóa đơn của tháng không hủy được.`
            : `Ghi nhận đã trả ${formatVnd(data?.totals.total ?? 0)} hoa hồng cho nhân viên. Thao tác này không hoàn tác được.`
        }
        confirmText={confirmKind === 'close' ? 'Chốt bảng' : 'Đã chi trả'}
        loading={busy}
        onConfirm={runConfirm}
      />
    </PermissionGuard>
  )
}

/** Mã kỳ, trạng thái, người chốt/chi trả; lý do chưa chốt được hiện bằng chữ (UC-11 E1) */
function PeriodInfo({ data, showBlocked, className }: { data: CommissionSheetDto; showBlocked: boolean; className?: string }) {
  return (
    <div className={cn('bg-card flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border px-4 py-2.5 text-sm shadow-xs lg:ml-auto', className)}>
      <span className="font-mono text-xs">{data.code}</span>
      <PeriodStatusBadge status={data.status} />
      {data.closedAt && (
        <span className="text-muted-foreground">
          Chốt: <span className="text-foreground">{data.closedByName ?? '—'}</span>, {vnHhmmDate(data.closedAt)}
        </span>
      )}
      {data.paidAt && (
        <span className="text-muted-foreground">
          Chi trả: <span className="text-foreground">{data.paidByName ?? '—'}</span>, {vnHhmmDate(data.paidAt)}
        </span>
      )}
      {showBlocked && data.status === 'TamTinh' && data.closeBlockedReason && (
        <span className="text-warning font-medium">{data.closeBlockedReason}</span>
      )}
    </div>
  )
}

/** Bảng tháng: mỗi nhân viên một dòng, bấm (hoặc Enter) mở chi tiết; dòng tổng cộng cuối bảng (FR-31) */
function SheetTable({ data, onOpen }: { data: CommissionSheetDto; onOpen: (row: CommissionRowDto) => void }) {
  const t = data.totals
  const onKey = (e: React.KeyboardEvent, row: CommissionRowDto) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(row)
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader className="bg-muted/50">
            <TableRow className="text-xs uppercase hover:bg-transparent">
              <TableHead>Nhân viên</TableHead>
              <TableHead className="text-right">Lượt dịch vụ</TableHead>
              <TableHead className="text-right">Doanh số tính HH</TableHead>
              <TableHead className="text-right">HH dịch vụ</TableHead>
              <TableHead className="text-right">Gói bán</TableHead>
              <TableHead className="text-right">HH bán gói</TableHead>
              <TableHead className="text-right">Tổng</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Xem chi tiết</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => {
              const clickable = !!r.staffMemberId
              return (
                <TableRow
                  key={r.staffMemberId ?? r.staffCode ?? r.staffName}
                  onClick={clickable ? () => onOpen(r) : undefined}
                  onKeyDown={clickable ? (e) => onKey(e, r) : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-label={clickable ? `Xem chi tiết hoa hồng của ${r.staffName}` : undefined}
                  className={cn(clickable && 'hover:bg-muted/50 focus-visible:bg-muted/60 cursor-pointer outline-none')}
                >
                  <TableCell>
                    <p className="font-medium">{r.staffName ?? 'Nhân viên đã xóa'}</p>
                    {r.staffCode && <p className="text-muted-foreground font-mono text-xs">{r.staffCode}</p>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.serviceCount, 0)}</TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">{formatVnd(r.serviceBase)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(r.serviceCommission)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.packageCount, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(r.packageCommission)}</TableCell>
                  <TableCell className="text-primary text-right font-semibold tabular-nums">{formatVnd(r.total)}</TableCell>
                  <TableCell className="text-muted-foreground">{clickable && <ChevronRight className="size-4" aria-hidden="true" />}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
          <tfoot className="bg-muted border-t font-semibold">
            <TableRow className="hover:bg-transparent">
              <TableCell>Tổng cộng ({data.rows.length} nhân viên)</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(t.serviceCount, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVnd(t.serviceBase)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVnd(t.serviceCommission)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(t.packageCount, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVnd(t.packageCommission)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVnd(t.total)}</TableCell>
              <TableCell />
            </TableRow>
          </tfoot>
        </Table>
      </div>
    </Card>
  )
}
