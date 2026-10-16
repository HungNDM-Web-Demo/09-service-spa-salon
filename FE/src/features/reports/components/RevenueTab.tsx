'use client'

import { ChartColumn, ClipboardCheck, PackageCheck, ReceiptText, Sparkles, TicketPercent, Wallet } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import { useRevenueReport } from '@/features/booking/hooks/use-spa'
import { ddmmyyyy, isoWeekdayOf, weekdayShort } from '@/features/booking/lib/vn-time'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RevenueReportDto } from '@/types/spa'
import { periodText, shortDateKey, type DateRange } from '../lib/date-range'
import { excelFileName, excelSheet, type ExcelColumn } from '../lib/export-excel'
import { changePercent, ChartCard, compactVnd, ExportButton, TabLoading, TableCard, TabToolbar } from './ReportParts'

const chartConfig = {
  serviceRevenue: { label: 'Dịch vụ lẻ', color: 'var(--chart-1)' },
  packageRevenue: { label: 'Bán gói', color: 'var(--chart-2)' },
  serviceValue: { label: 'Giá trị dịch vụ đã làm', color: 'var(--chart-3)' },
} satisfies ChartConfig

type DayRow = RevenueReportDto['days'][number] & { label?: string }

const COLUMNS: ExcelColumn<DayRow>[] = [
  { header: 'Ngày', value: (r) => r.label ?? ddmmyyyy(r.date), width: 14 },
  { header: 'Dịch vụ lẻ', value: (r) => r.serviceRevenue, width: 16 },
  { header: 'Bán gói', value: (r) => r.packageRevenue, width: 16 },
  { header: 'Thực thu', value: (r) => r.revenue, width: 16 },
  { header: 'Giá trị dịch vụ đã làm', value: (r) => r.serviceValue, width: 22 },
  { header: 'Số hóa đơn', value: (r) => r.invoiceCount, width: 12 },
  { header: 'Giảm giá', value: (r) => r.discount, width: 14 },
]

type CompareRow = { metric: string; current: number; previous: number }

/**
 * Tab Doanh thu (UC-15 bước 2; FR-36, BR-29): thẻ số so với kỳ liền trước cùng độ dài, biểu đồ cột chồng thực thu
 * (dịch vụ lẻ, bán gói) theo ngày kèm đường giá trị dịch vụ đã làm, bảng số liệu theo ngày.
 */
export function RevenueTab({ range }: { range: DateRange }) {
  const report = useRevenueReport(range)
  const data = report.data

  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading cards={6} />

  const t = data.totals
  const p = data.previous
  const prevLabel = `so với ${ddmmyyyy(p.from)}–${ddmmyyyy(p.to)}`
  const empty = t.invoiceCount === 0
  const filters = periodText(data)

  const compare: CompareRow[] = [
    { metric: 'Thực thu', current: t.revenue, previous: p.revenue },
    { metric: 'Dịch vụ lẻ', current: t.serviceRevenue, previous: p.serviceRevenue },
    { metric: 'Bán gói', current: t.packageRevenue, previous: p.packageRevenue },
    { metric: 'Giá trị dịch vụ đã làm', current: t.serviceValue, previous: p.serviceValue },
    { metric: 'Số hóa đơn', current: t.invoiceCount, previous: p.invoiceCount },
    { metric: 'Giảm giá', current: t.discount, previous: p.discount },
  ]
  const totalRow: DayRow = {
    label: 'Tổng cộng',
    date: '',
    serviceRevenue: t.serviceRevenue,
    packageRevenue: t.packageRevenue,
    revenue: t.revenue,
    serviceValue: t.serviceValue,
    invoiceCount: t.invoiceCount,
    discount: t.discount,
  }

  return (
    <div className={cn('space-y-4 transition-opacity', report.isFetching && 'opacity-70')}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Thực thu" value={formatVnd(t.revenue)} icon={Wallet} change={changePercent(t.revenue, p.revenue)} changeLabel={prevLabel} />
        <KpiCard
          label="Dịch vụ lẻ (đã trừ giảm giá)"
          value={formatVnd(t.serviceRevenue)}
          icon={Sparkles}
          change={changePercent(t.serviceRevenue, p.serviceRevenue)}
          changeLabel={prevLabel}
        />
        <KpiCard
          label="Bán gói"
          value={formatVnd(t.packageRevenue)}
          icon={PackageCheck}
          change={changePercent(t.packageRevenue, p.packageRevenue)}
          changeLabel={prevLabel}
        />
        <KpiCard
          label="Giá trị dịch vụ đã làm"
          value={formatVnd(t.serviceValue)}
          icon={ClipboardCheck}
          change={changePercent(t.serviceValue, p.serviceValue)}
          changeLabel={prevLabel}
        />
        <KpiCard
          label="Số hóa đơn"
          value={formatNumber(t.invoiceCount, 0)}
          icon={ReceiptText}
          change={changePercent(t.invoiceCount, p.invoiceCount)}
          changeLabel={prevLabel}
        />
        <KpiCard
          label="Giảm giá"
          value={formatVnd(t.discount)}
          icon={TicketPercent}
          change={changePercent(t.discount, p.discount)}
          changeLabel={prevLabel}
          inverse
        />
      </div>
      <p className="text-muted-foreground text-xs text-pretty">
        Thực thu là tiền của hóa đơn đã thanh toán theo ngày thanh toán, không gồm hóa đơn đã hủy. Giá trị dịch vụ đã làm tính
        theo giá căn cứ từng dòng dịch vụ, buổi trừ gói tính theo giá trị một buổi (BR-29). Kỳ trước chưa có số liệu thì không
        hiện % thay đổi.
      </p>

      <TabToolbar title="Doanh thu theo ngày">
        <ExportButton
          fileName={excelFileName('Báo cáo doanh thu', data.from, data.to)}
          disabled={empty}
          build={() => [
            excelSheet('Doanh thu theo ngày', 'BÁO CÁO DOANH THU THEO NGÀY', filters, COLUMNS, data.days, totalRow),
            excelSheet(
              'So với kỳ trước',
              'SO VỚI KỲ TRƯỚC',
              `${filters} · Kỳ trước ${ddmmyyyy(p.from)} – ${ddmmyyyy(p.to)}`,
              [
                { header: 'Chỉ số', value: (r: CompareRow) => r.metric, width: 24 },
                { header: 'Kỳ này', value: (r) => r.current, width: 16 },
                { header: 'Kỳ trước', value: (r) => r.previous, width: 16 },
                {
                  header: 'Thay đổi (%)',
                  value: (r) => {
                    const c = changePercent(r.current, r.previous)
                    return c === undefined ? null : c
                  },
                  format: '0.0',
                  width: 14,
                },
              ],
              compare
            ),
          ]}
        />
      </TabToolbar>

      {empty ? (
        <Card>
          <EmptyState icon={ChartColumn} title="Chưa có hóa đơn trong kỳ" description="Chọn khoảng ngày khác để xem doanh thu." />
        </Card>
      ) : (
        <>
          <ChartCard title="Thực thu và giá trị dịch vụ đã làm" description="Cột chồng: dịch vụ lẻ và bán gói. Đường: giá trị dịch vụ đã làm.">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-72 w-full"
              aria-label="Biểu đồ cột chồng thực thu dịch vụ lẻ và bán gói theo ngày, kèm đường giá trị dịch vụ đã làm"
            >
              <ComposedChart data={data.days} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDateKey} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tickFormatter={compactVnd} tickLine={false} axisLine={false} width={56} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const date = String(payload?.[0]?.payload?.date ?? '')
                        return date ? `${weekdayShort(isoWeekdayOf(date))}, ${ddmmyyyy(date)}` : ''
                      }}
                      formatter={(value, name) => (
                        <div className="flex w-full items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: `var(--color-${String(name)})` }}
                            aria-hidden="true"
                          />
                          <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                          <span className="ml-auto pl-3 font-medium tabular-nums">{formatVnd(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="serviceRevenue" stackId="revenue" fill="var(--color-serviceRevenue)" maxBarSize={28} />
                <Bar dataKey="packageRevenue" stackId="revenue" fill="var(--color-packageRevenue)" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line
                  dataKey="serviceValue"
                  type="monotone"
                  stroke="var(--color-serviceValue)"
                  strokeWidth={2}
                  dot={data.days.length <= 31 ? { r: 2.5 } : false}
                />
              </ComposedChart>
            </ChartContainer>
          </ChartCard>

          <TableCard minWidth={860} scroll>
            <TableHeader className="bg-muted sticky top-0 z-10">
              <TableRow className="text-xs uppercase hover:bg-transparent">
                <TableHead>Ngày</TableHead>
                <TableHead className="text-right">Dịch vụ lẻ</TableHead>
                <TableHead className="text-right">Bán gói</TableHead>
                <TableHead className="text-right">Thực thu</TableHead>
                <TableHead className="text-right">Giá trị DV đã làm</TableHead>
                <TableHead className="text-right">Số hóa đơn</TableHead>
                <TableHead className="text-right">Giảm giá</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.days.map((d) => (
                <TableRow key={d.date} className={cn(d.invoiceCount === 0 && 'text-muted-foreground')}>
                  <TableCell className="tabular-nums">
                    <span className="text-muted-foreground mr-1.5 inline-block w-7 text-xs">{weekdayShort(isoWeekdayOf(d.date))}</span>
                    {ddmmyyyy(d.date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(d.serviceRevenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(d.packageRevenue)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatVnd(d.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(d.serviceValue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(d.invoiceCount, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(d.discount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <tfoot className="bg-muted sticky bottom-0 border-t font-semibold">
              <TableRow className="hover:bg-transparent">
                <TableCell>Tổng cộng</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(t.serviceRevenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(t.packageRevenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(t.revenue)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(t.serviceValue)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(t.invoiceCount, 0)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(t.discount)}</TableCell>
              </TableRow>
            </tfoot>
          </TableCard>
        </>
      )}
    </div>
  )
}
