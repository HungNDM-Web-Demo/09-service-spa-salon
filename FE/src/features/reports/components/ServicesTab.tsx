'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Card } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useServiceGroups, useServiceReport } from '@/features/booking/hooks/use-spa'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ServiceReportDto } from '@/types/spa'
import { periodText, type DateRange } from '../lib/date-range'
import { excelFileName, excelSheet, type ExcelColumn } from '../lib/export-excel'
import { ChartCard, compactVnd, ExportButton, formatPercent, ratePercent, Stat, TabLoading, TableCard, TabToolbar } from './ReportParts'

const ALL = 'all'

const chartConfig = { value: { label: 'Giá trị', color: 'var(--chart-1)' } } satisfies ChartConfig

type ServiceRow = ServiceReportDto['rows'][number]

const COLUMNS: ExcelColumn<Partial<ServiceRow>>[] = [
  { header: 'Mã', value: (r) => r.code, width: 10 },
  { header: 'Dịch vụ', value: (r) => r.name, width: 36 },
  { header: 'Nhóm', value: (r) => r.groupName, width: 22 },
  { header: 'Số lượt', value: (r) => r.count, width: 10 },
  { header: 'Giá trị', value: (r) => r.value, width: 16 },
  { header: 'Tỉ trọng (%)', value: (r) => r.share, format: '0.0', width: 12 },
  { header: 'Lượt trừ buổi', value: (r) => r.packageCount, width: 14 },
]

/** Thanh tỉ trọng (kèm số %, không chỉ dựa vào màu) */
function ShareBar({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="bg-muted h-2 w-20 overflow-hidden rounded-full" aria-hidden="true">
        <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{formatPercent(value)}</span>
    </div>
  )
}

/**
 * Tab Dịch vụ (UC-15 bước 4; FR-37, 07 §3.11): số lượt, giá trị (giá căn cứ), tỉ trọng giá trị, số lượt trừ buổi của
 * từng dịch vụ; lọc theo nhóm dịch vụ; biểu đồ 10 dịch vụ giá trị cao nhất.
 */
export function ServicesTab({ range }: { range: DateRange }) {
  const [groupId, setGroupId] = useState<string | undefined>()
  const groups = useServiceGroups()
  const report = useServiceReport({ ...range, groupId })
  const data = report.data

  const filterSelect = (
    <Select value={groupId ?? ALL} onValueChange={(v) => setGroupId(v === ALL ? undefined : v)}>
      <SelectTrigger className="w-56" aria-label="Lọc theo nhóm dịch vụ">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Mọi nhóm dịch vụ</SelectItem>
        {(groups.data ?? []).map((g) => (
          <SelectItem key={g.id} value={g.id}>
            {g.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading />

  const groupName = groups.data?.find((g) => g.id === groupId)?.name
  const filters = `${periodText(range)}${groupName ? ` · Nhóm ${groupName}` : ' · Mọi nhóm dịch vụ'}`
  const top = data.rows.slice(0, 10)

  return (
    <div className={cn('space-y-4 transition-opacity', report.isFetching && 'opacity-70')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Lượt dịch vụ đã làm" value={formatNumber(data.totalCount, 0)} />
        <Stat label="Giá trị dịch vụ đã làm" value={formatVnd(data.totalValue)} />
        <Stat
          label="Lượt trừ buổi gói"
          value={formatNumber(data.totalPackageCount, 0)}
          sub={`${formatPercent(ratePercent(data.totalPackageCount, data.totalCount))} số lượt`}
        />
        <Stat label="Số dịch vụ có khách làm" value={formatNumber(data.rows.length, 0)} />
      </div>

      <TabToolbar title="Theo dịch vụ">
        {filterSelect}
        <ExportButton
          fileName={excelFileName('Báo cáo dịch vụ', range.from, range.to)}
          disabled={!data.rows.length}
          build={() => [
            excelSheet('Theo dịch vụ', 'BÁO CÁO THEO DỊCH VỤ', filters, COLUMNS, data.rows, {
              name: 'Tổng cộng',
              count: data.totalCount,
              value: data.totalValue,
              share: data.totalValue > 0 ? 100 : 0,
              packageCount: data.totalPackageCount,
            }),
          ]}
        />
      </TabToolbar>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="Chưa có lượt dịch vụ nào trong kỳ"
            description={groupName ? `Nhóm ${groupName} chưa có hóa đơn trong khoảng ngày đã chọn.` : 'Chọn khoảng ngày khác để xem.'}
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <TableCard minWidth={720}>
              <TableHeader className="bg-muted/50">
                <TableRow className="text-xs uppercase hover:bg-transparent">
                  <TableHead>Dịch vụ</TableHead>
                  <TableHead>Nhóm</TableHead>
                  <TableHead className="text-right">Số lượt</TableHead>
                  <TableHead className="text-right">Giá trị</TableHead>
                  <TableHead className="text-right">Tỉ trọng</TableHead>
                  <TableHead className="text-right">Trừ buổi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.serviceId}>
                    <TableCell>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-muted-foreground font-mono text-xs">{r.code}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.groupName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.count, 0)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.value)}</TableCell>
                    <TableCell>
                      <ShareBar value={r.share} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.packageCount, 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot className="bg-muted border-t font-semibold">
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2}>Tổng cộng</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(data.totalCount, 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(data.totalValue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(data.totalValue > 0 ? 100 : 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(data.totalPackageCount, 0)}</TableCell>
                </TableRow>
              </tfoot>
            </TableCard>
          </div>
          <div className="xl:col-span-2">
            <ChartCard title="10 dịch vụ giá trị cao nhất" description="Giá trị theo giá căn cứ, gồm cả buổi trừ gói.">
              <ChartContainer
                config={chartConfig}
                className="aspect-auto w-full"
                style={{ height: Math.max(160, top.length * 36 + 24) }}
                aria-label="Biểu đồ thanh ngang giá trị 10 dịch vụ cao nhất"
              >
                <BarChart data={top} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickFormatter={compactVnd} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={128}
                    tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => String(payload?.[0]?.payload?.name ?? '')}
                        formatter={(value, _name, item) => (
                          <div className="flex w-full flex-col gap-0.5">
                            <span className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Giá trị</span>
                              <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                            </span>
                            <span className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Số lượt</span>
                              <span className="tabular-nums">{formatNumber(Number(item?.payload?.count ?? 0), 0)}</span>
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="value" fill="var(--color-value)" radius={[0, 3, 3, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  )
}
