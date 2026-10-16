'use client'

import { CalendarClock, Package } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/card'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePackageReport } from '@/features/booking/hooks/use-spa'
import { ddmmyyyy, diffDaysKey, vnToday } from '@/features/booking/lib/vn-time'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CustomerPackageDto, PackageReportDto } from '@/types/spa'
import { periodText, type DateRange } from '../lib/date-range'
import { excelFileName, excelSheet, type ExcelColumn } from '../lib/export-excel'
import { ExportButton, Stat, TabLoading, TableCard, TabToolbar } from './ReportParts'

type TemplateRow = PackageReportDto['rows'][number]

const COLUMNS: ExcelColumn<Partial<TemplateRow>>[] = [
  { header: 'Mã gói', value: (r) => r.code, width: 10 },
  { header: 'Gói liệu trình', value: (r) => r.name, width: 36 },
  { header: 'Số gói bán', value: (r) => r.soldCount, width: 12 },
  { header: 'Tiền bán gói', value: (r) => r.soldAmount, width: 16 },
  { header: 'Buổi đã dùng trong kỳ', value: (r) => r.usedSessions, width: 20 },
]

const EXPIRING_COLUMNS: ExcelColumn<CustomerPackageDto>[] = [
  { header: 'Mã gói khách', value: (p) => p.code, width: 16 },
  { header: 'Mã khách', value: (p) => p.customerCode, width: 10 },
  { header: 'Khách hàng', value: (p) => p.customerName, width: 26 },
  { header: 'Gói liệu trình', value: (p) => p.packageName, width: 32 },
  { header: 'Còn lại (buổi)', value: (p) => p.remaining, width: 14 },
  { header: 'Tổng buổi', value: (p) => p.totalSessions, width: 10 },
  { header: 'Giá trị còn lại', value: (p) => p.remaining * p.sessionValue, width: 16 },
  { header: 'Hạn dùng', value: (p) => ddmmyyyy(p.expiryDate), width: 12 },
]

/**
 * Tab Gói liệu trình (UC-15 bước 4; 07 §3.11): gói bán và tiền bán gói trong kỳ, gói đang dùng và giá trị buổi chưa
 * dùng (tại thời điểm xem), bảng theo gói mẫu, danh sách gói sắp hết hạn trong 30 ngày.
 */
export function PackagesTab({ range }: { range: DateRange }) {
  const report = usePackageReport(range)
  const data = report.data

  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading cards={5} />

  const today = vnToday()
  const filters = periodText(range)
  const totalRow: Partial<TemplateRow> = {
    name: 'Tổng cộng',
    soldCount: data.rows.reduce((s, r) => s + r.soldCount, 0),
    soldAmount: data.rows.reduce((s, r) => s + r.soldAmount, 0),
    usedSessions: data.rows.reduce((s, r) => s + r.usedSessions, 0),
  }

  return (
    <div className={cn('space-y-4 transition-opacity', report.isFetching && 'opacity-70')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label="Gói bán trong kỳ" value={formatNumber(data.soldCount, 0)} />
        <Stat label="Tiền bán gói" value={formatVnd(data.soldAmount)} tone="success" />
        <Stat label="Gói đang dùng" value={formatNumber(data.activeCount, 0)} sub="Tại thời điểm xem" />
        <Stat label="Buổi chưa dùng" value={formatNumber(data.unusedSessions, 0)} sub="Của gói đang dùng" />
        <Stat label="Giá trị buổi chưa dùng" value={formatVnd(data.unusedValue)} tone="warning" sub="Tiệm còn nợ dịch vụ" />
      </div>

      <TabToolbar title="Theo gói mẫu">
        <ExportButton
          fileName={excelFileName('Báo cáo gói liệu trình', range.from, range.to)}
          disabled={!data.rows.length && !data.expiringSoon.length}
          build={() => [
            excelSheet('Theo gói mẫu', 'BÁO CÁO GÓI LIỆU TRÌNH', filters, COLUMNS, data.rows, totalRow),
            excelSheet(
              'Gói sắp hết hạn',
              'GÓI SẮP HẾT HẠN (30 NGÀY)',
              `Tính tới ${ddmmyyyy(today)}`,
              EXPIRING_COLUMNS,
              data.expiringSoon
            ),
          ]}
        />
      </TabToolbar>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState icon={Package} title="Chưa bán hoặc dùng gói nào trong kỳ" description="Chọn khoảng ngày khác để xem." compact />
        </Card>
      ) : (
        <TableCard minWidth={640}>
          <TableHeader className="bg-muted/50">
            <TableRow className="text-xs uppercase hover:bg-transparent">
              <TableHead>Gói liệu trình</TableHead>
              <TableHead className="text-right">Số gói bán</TableHead>
              <TableHead className="text-right">Tiền bán gói</TableHead>
              <TableHead className="text-right">Buổi đã dùng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.packageTemplateId}>
                <TableCell>
                  <p className="font-medium">{r.name}</p>
                  {r.code && <p className="text-muted-foreground font-mono text-xs">{r.code}</p>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.soldCount, 0)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.soldAmount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.usedSessions, 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot className="bg-muted border-t font-semibold">
            <TableRow className="hover:bg-transparent">
              <TableCell>Tổng cộng</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(totalRow.soldCount, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVnd(totalRow.soldAmount)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(totalRow.usedSessions, 0)}</TableCell>
            </TableRow>
          </tfoot>
        </TableCard>
      )}

      <TabToolbar title={`Gói sắp hết hạn trong 30 ngày (${data.expiringSoon.length})`} />
      {data.expiringSoon.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarClock} title="Không có gói sắp hết hạn" description="Các gói đang dùng còn hạn trên 30 ngày." compact />
        </Card>
      ) : (
        <TableCard minWidth={760}>
          <TableHeader className="bg-muted/50">
            <TableRow className="text-xs uppercase hover:bg-transparent">
              <TableHead>Mã gói</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Gói liệu trình</TableHead>
              <TableHead className="text-right">Còn lại</TableHead>
              <TableHead>Hạn dùng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.expiringSoon.map((p) => {
              const daysLeft = diffDaysKey(today, p.expiryDate)
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">{p.code}</TableCell>
                  <TableCell>
                    <p className="font-medium">{p.customerName}</p>
                    <p className="text-muted-foreground font-mono text-xs">{p.customerCode}</p>
                  </TableCell>
                  <TableCell>{p.packageName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{p.remaining}</span>/{p.totalSessions} buổi
                    <p className="text-muted-foreground text-xs">{formatVnd(p.remaining * p.sessionValue)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums">{ddmmyyyy(p.expiryDate)}</span>
                      <StatusBadge tone={daysLeft <= 7 ? 'danger' : 'warning'}>
                        {daysLeft === 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`}
                      </StatusBadge>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </TableCard>
      )}
    </div>
  )
}
