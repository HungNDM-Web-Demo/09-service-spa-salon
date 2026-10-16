'use client'

import { CalendarX2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card } from '@/components/ui/card'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCancellationReport } from '@/features/booking/hooks/use-spa'
import { sourceLabels } from '@/features/booking/lib/labels'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CancellationReportDto } from '@/types/spa'
import { periodText, type DateRange } from '../lib/date-range'
import { excelFileName, excelSheet, type ExcelColumn } from '../lib/export-excel'
import { ExportButton, formatPercent, ratePercent, Stat, TabLoading, TableCard, TabToolbar } from './ReportParts'

type SourceRow = { label: string; total: number; cancelled: number; noShow: number }

const COLUMNS: ExcelColumn<SourceRow>[] = [
  { header: 'Nguồn đặt lịch', value: (r) => r.label, width: 20 },
  { header: 'Tổng lịch', value: (r) => r.total, width: 12 },
  { header: 'Đã hủy', value: (r) => r.cancelled, width: 10 },
  { header: 'Tỉ lệ hủy (%)', value: (r) => ratePercent(r.cancelled, r.total), format: '0.0', width: 14 },
  { header: 'Không đến', value: (r) => r.noShow, width: 12 },
  { header: 'Tỉ lệ không đến (%)', value: (r) => ratePercent(r.noShow, r.total), format: '0.0', width: 18 },
]

const toRows = (data: CancellationReportDto): SourceRow[] =>
  data.bySource.map((s) => ({ label: sourceLabels[s.source], total: s.total, cancelled: s.cancelled, noShow: s.noShow }))

/**
 * Tab Hủy và không đến (UC-15 bước 4; FR-38, 07 §3.11): lịch có ngày hẹn trong kỳ, tỉ lệ hủy và không đến trên tổng
 * lịch, chia theo nguồn đặt lịch.
 */
export function CancellationsTab({ range }: { range: DateRange }) {
  const report = useCancellationReport(range)
  const data = report.data

  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading cards={5} />

  const rows = toRows(data)
  const totalRow: SourceRow = { label: 'Tổng cộng', total: data.total, cancelled: data.cancelled, noShow: data.noShow }

  return (
    <div className={cn('space-y-4 transition-opacity', report.isFetching && 'opacity-70')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label="Tổng lịch hẹn" value={formatNumber(data.total, 0)} sub="Theo ngày hẹn trong kỳ" />
        <Stat label="Đã hủy" value={formatNumber(data.cancelled, 0)} />
        <Stat label="Không đến" value={formatNumber(data.noShow, 0)} />
        <Stat label="Tỉ lệ hủy" value={formatPercent(data.cancelRate)} tone="warning" />
        <Stat label="Tỉ lệ không đến" value={formatPercent(data.noShowRate)} tone="destructive" />
      </div>

      <TabToolbar title="Theo nguồn đặt lịch">
        <ExportButton
          fileName={excelFileName('Báo cáo hủy và không đến', range.from, range.to)}
          disabled={data.total === 0}
          build={() => [excelSheet('Hủy và không đến', 'BÁO CÁO HỦY VÀ KHÔNG ĐẾN', periodText(range), COLUMNS, rows, totalRow)]}
        />
      </TabToolbar>

      {data.total === 0 ? (
        <Card>
          <EmptyState icon={CalendarX2} title="Chưa có lịch hẹn trong kỳ" description="Chọn khoảng ngày khác để xem." />
        </Card>
      ) : (
        <TableCard minWidth={720}>
          <TableHeader className="bg-muted/50">
            <TableRow className="text-xs uppercase hover:bg-transparent">
              <TableHead>Nguồn đặt lịch</TableHead>
              <TableHead className="text-right">Tổng lịch</TableHead>
              <TableHead className="text-right">Đã hủy</TableHead>
              <TableHead className="text-right">Tỉ lệ hủy</TableHead>
              <TableHead className="text-right">Không đến</TableHead>
              <TableHead className="text-right">Tỉ lệ không đến</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label} className={cn(r.total === 0 && 'text-muted-foreground')}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.total, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.cancelled, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(ratePercent(r.cancelled, r.total))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.noShow, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(ratePercent(r.noShow, r.total))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot className="bg-muted border-t font-semibold">
            <TableRow className="hover:bg-transparent">
              <TableCell>Tổng cộng</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(data.total, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(data.cancelled, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(data.cancelRate)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(data.noShow, 0)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(data.noShowRate)}</TableCell>
            </TableRow>
          </tfoot>
        </TableCard>
      )}
    </div>
  )
}
