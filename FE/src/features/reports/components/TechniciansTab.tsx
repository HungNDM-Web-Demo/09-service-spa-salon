'use client'

import { UserCog } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTechnicianReport } from '@/features/booking/hooks/use-spa'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TechnicianReportDto } from '@/types/spa'
import { periodText, type DateRange } from '../lib/date-range'
import { excelFileName, excelSheet, type ExcelColumn } from '../lib/export-excel'
import { ChartCard, ExportButton, formatPercent, hoursText, ratePercent, Stat, TabLoading, TableCard, TabToolbar } from './ReportParts'

const chartConfig = { occupancy: { label: 'Tỉ lệ lấp lịch', color: 'var(--chart-3)' } } satisfies ChartConfig

type TechRow = TechnicianReportDto['rows'][number]

const hours1 = (minutes: number) => Math.round((minutes / 60) * 10) / 10

const COLUMNS: ExcelColumn<Partial<TechRow>>[] = [
  { header: 'Mã', value: (r) => r.code, width: 10 },
  { header: 'Kỹ thuật viên', value: (r) => r.fullName, width: 28 },
  { header: 'Số lượt', value: (r) => r.count, width: 10 },
  { header: 'Giá trị dịch vụ đã làm', value: (r) => r.value, width: 22 },
  { header: 'Giờ làm dịch vụ', value: (r) => (r.bookedMinutes === undefined ? null : hours1(r.bookedMinutes)), format: '0.0', width: 16 },
  { header: 'Giờ ca làm', value: (r) => (r.shiftMinutes === undefined ? null : hours1(r.shiftMinutes)), format: '0.0', width: 12 },
  { header: 'Tỉ lệ lấp lịch (%)', value: (r) => r.occupancy, format: '0.0', width: 18 },
  { header: 'Hoa hồng', value: (r) => r.commission, width: 16 },
]

/**
 * Tab Kỹ thuật viên (UC-15 bước 4; FR-37, BR-29): số lượt, giá trị dịch vụ đã làm, giờ làm dịch vụ trên giờ ca
 * (tỉ lệ lấp lịch, tính tới hôm nay), hoa hồng mọi loại trong kỳ.
 */
export function TechniciansTab({ range }: { range: DateRange }) {
  const report = useTechnicianReport(range)
  const data = report.data

  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading />

  const rows = data.rows
  const sum = rows.reduce(
    (s, r) => ({
      count: s.count + r.count,
      value: s.value + r.value,
      bookedMinutes: s.bookedMinutes + r.bookedMinutes,
      shiftMinutes: s.shiftMinutes + r.shiftMinutes,
      commission: s.commission + r.commission,
    }),
    { count: 0, value: 0, bookedMinutes: 0, shiftMinutes: 0, commission: 0 }
  )
  const occupancy = ratePercent(sum.bookedMinutes, sum.shiftMinutes)
  const chartData = [...rows].sort((a, b) => b.occupancy - a.occupancy)

  return (
    <div className={cn('space-y-4 transition-opacity', report.isFetching && 'opacity-70')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lượt dịch vụ" value={formatNumber(sum.count, 0)} sub={`${rows.length} kỹ thuật viên`} />
        <Stat label="Giá trị dịch vụ đã làm" value={formatVnd(sum.value)} />
        <Stat label="Tỉ lệ lấp lịch chung" value={formatPercent(occupancy)} sub={`${hoursText(sum.bookedMinutes)} / ${hoursText(sum.shiftMinutes)} ca làm`} />
        <Stat label="Hoa hồng phát sinh" value={formatVnd(sum.commission)} sub="Dịch vụ và bán gói" />
      </div>

      <TabToolbar title="Theo kỹ thuật viên">
        <ExportButton
          fileName={excelFileName('Báo cáo kỹ thuật viên', range.from, range.to)}
          disabled={!rows.length}
          build={() => [
            excelSheet('Theo kỹ thuật viên', 'BÁO CÁO THEO KỸ THUẬT VIÊN', periodText(range), COLUMNS, rows, {
              fullName: 'Tổng cộng',
              ...sum,
              occupancy,
            }),
          ]}
        />
      </TabToolbar>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={UserCog} title="Chưa có kỹ thuật viên" description="Thêm kỹ thuật viên ở trang Nhân viên để xem báo cáo." />
        </Card>
      ) : (
        <>
          <TableCard minWidth={900}>
            <TableHeader className="bg-muted/50">
              <TableRow className="text-xs uppercase hover:bg-transparent">
                <TableHead>Kỹ thuật viên</TableHead>
                <TableHead className="text-right">Số lượt</TableHead>
                <TableHead className="text-right">Giá trị DV đã làm</TableHead>
                <TableHead className="text-right">Giờ làm DV</TableHead>
                <TableHead className="text-right">Giờ ca làm</TableHead>
                <TableHead className="text-right">Lấp lịch</TableHead>
                <TableHead className="text-right">Hoa hồng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.staffMemberId}>
                  <TableCell>
                    <p className="font-medium">{r.fullName}</p>
                    <p className="text-muted-foreground font-mono text-xs">{r.code}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.count, 0)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.value)}</TableCell>
                  <TableCell className="text-right tabular-nums">{hoursText(r.bookedMinutes)}</TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">{hoursText(r.shiftMinutes)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatPercent(r.occupancy)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(r.commission)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot className="bg-muted border-t font-semibold">
              <TableRow className="hover:bg-transparent">
                <TableCell>Tổng cộng</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(sum.count, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(sum.value)}</TableCell>
                <TableCell className="text-right tabular-nums">{hoursText(sum.bookedMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{hoursText(sum.shiftMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(occupancy)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(sum.commission)}</TableCell>
              </TableRow>
            </tfoot>
          </TableCard>

          <ChartCard
            title="Tỉ lệ lấp lịch theo kỹ thuật viên"
            description="Giờ làm dịch vụ đã thanh toán ÷ giờ ca làm trong kỳ (tới hôm nay, trừ ngày nghỉ) × 100%."
          >
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" aria-label="Biểu đồ cột tỉ lệ lấp lịch của từng kỹ thuật viên">
              <BarChart data={chartData} margin={{ left: 4, right: 8, top: 20 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="fullName"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tickFormatter={(v: string) => v.split(' ').slice(-2).join(' ')}
                />
                <YAxis tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} width={44} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => String(payload?.[0]?.payload?.fullName ?? '')}
                      formatter={(value, _name, item) => (
                        <div className="flex w-full flex-col gap-0.5">
                          <span className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Lấp lịch</span>
                            <span className="font-medium tabular-nums">{formatPercent(Number(value))}</span>
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            {hoursText(Number(item?.payload?.bookedMinutes ?? 0))} / {hoursText(Number(item?.payload?.shiftMinutes ?? 0))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="occupancy" fill="var(--color-occupancy)" radius={[3, 3, 0, 0]} maxBarSize={44}>
                  <LabelList
                    dataKey="occupancy"
                    position="top"
                    className="fill-foreground"
                    fontSize={11}
                    formatter={(v: unknown) => formatPercent(Number(v))}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </ChartCard>
        </>
      )}
    </div>
  )
}
