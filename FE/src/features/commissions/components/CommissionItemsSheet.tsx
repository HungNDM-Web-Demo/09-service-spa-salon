'use client'

import Link from 'next/link'
import { ReceiptText } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { formatVnd } from '@/lib/format'
import type { CommissionRowDto } from '@/types/spa'
import { useCommissionItems } from '@/features/booking/hooks/use-spa'
import { commissionKindLabels } from '@/features/booking/lib/labels'
import { vnDdMmYyyy, vnHhmm } from '@/features/booking/lib/vn-time'
import { monthDisplay, rateText } from '../lib/month'

export type CommissionSheetTarget = { month: string; row: CommissionRowDto }

/**
 * Ngăn kéo chi tiết hoa hồng một nhân viên trong tháng (UC-11 bước 3; FR-31): ngày, hóa đơn, khách, loại, dịch vụ
 * hoặc gói, giá căn cứ, mức (phần trăm hoặc cố định), số tiền.
 */
export function CommissionItemsSheet({
  target,
  open,
  onOpenChange,
}: {
  target: CommissionSheetTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = usePermissions()
  const items = useCommissionItems(target?.month ?? '', target?.row.staffMemberId ?? null)
  const row = target?.row
  const canOpenAppointment = can(permissions.appointments.view)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Ghi đè đúng biến thể data-[side=right] của SheetContent (w-3/4, sm:max-w-sm) để tailwind-merge thay được */}
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-lg font-semibold">{row?.staffName ?? 'Nhân viên'}</SheetTitle>
          <SheetDescription>
            Chi tiết hoa hồng tháng {target ? monthDisplay(target.month) : ''}
            {row?.staffCode ? ` · ${row.staffCode}` : ''}
          </SheetDescription>
          {row && (
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div className="bg-muted/60 rounded-lg px-3 py-2">
                <dt className="text-muted-foreground text-xs">Dịch vụ ({row.serviceCount} lượt)</dt>
                <dd className="font-semibold tabular-nums">{formatVnd(row.serviceCommission)}</dd>
              </div>
              <div className="bg-muted/60 rounded-lg px-3 py-2">
                <dt className="text-muted-foreground text-xs">Bán gói ({row.packageCount} gói)</dt>
                <dd className="font-semibold tabular-nums">{formatVnd(row.packageCommission)}</dd>
              </div>
              <div className="bg-primary/10 rounded-lg px-3 py-2">
                <dt className="text-muted-foreground text-xs">Tổng</dt>
                <dd className="text-primary font-semibold tabular-nums">{formatVnd(row.total)}</dd>
              </div>
            </dl>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          {items.isLoading ? (
            <div className="space-y-3 p-4" aria-busy="true" aria-label="Đang tải chi tiết">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.error ? (
            <ErrorState error={items.error} onRetry={() => void items.refetch()} />
          ) : !items.data?.length ? (
            <EmptyState icon={ReceiptText} title="Không có khoản hoa hồng" compact />
          ) : (
            <Table className="min-w-[760px]">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow className="text-xs uppercase hover:bg-transparent">
                  <TableHead>Ngày</TableHead>
                  <TableHead>Hóa đơn</TableHead>
                  <TableHead>Khách</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead className="text-right">Giá căn cứ</TableHead>
                  <TableHead className="text-right">Mức</TableHead>
                  <TableHead className="text-right">Hoa hồng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="tabular-nums">
                      {vnDdMmYyyy(c.earnedAt)}
                      <p className="text-muted-foreground text-xs">{vnHhmm(c.earnedAt)}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.appointmentId && canOpenAppointment ? (
                        <Link
                          href={routePath.appointmentDetail(c.appointmentId)}
                          className="text-primary underline-offset-4 hover:underline"
                          aria-label={`Mở lịch hẹn của hóa đơn ${c.invoiceCode}`}
                        >
                          {c.invoiceCode}
                        </Link>
                      ) : (
                        c.invoiceCode
                      )}
                    </TableCell>
                    <TableCell>{c.customerName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={c.kind === 'BanGoi' ? 'primary' : 'info'} dot={false}>
                          {commissionKindLabels[c.kind]}
                        </StatusBadge>
                        <span className="line-clamp-2">{c.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatVnd(c.baseAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rateText(c.rateType, c.rateValue)}
                      {c.rateType === 'CoDinh' && <p className="text-muted-foreground text-xs">cố định</p>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatVnd(c.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot className="bg-muted sticky bottom-0 border-t font-semibold">
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>Tổng {items.data.length} khoản</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(items.data.reduce((s, c) => s + c.amount, 0))}</TableCell>
                </TableRow>
              </tfoot>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
