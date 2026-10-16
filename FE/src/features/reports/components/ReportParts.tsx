'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportExcel, type ExcelSheet } from '../lib/export-excel'

/** Trục tiền gọn: 1.250.000 → "1,3tr", 85.000 → "85k", 1.250.000.000 → "1,3 tỷ" */
export const compactVnd = (v: number) =>
  Math.abs(v) >= 1_000_000_000
    ? `${formatNumber(v / 1_000_000_000, 1)} tỷ`
    : Math.abs(v) >= 1_000_000
      ? `${formatNumber(v / 1_000_000, 1)}tr`
      : Math.abs(v) >= 1000
        ? `${formatNumber(v / 1000, 0)}k`
        : formatNumber(v, 0)

/** 12.5 → "12,5%" (1 chữ số thập phân, BR-29) */
export const formatPercent = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${formatNumber(v, 1)}%`

/** Số phút → giờ, 1 chữ số thập phân: 750 → "12,5 giờ" */
export const hoursText = (minutes: number) => `${formatNumber(minutes / 60, 1)} giờ`

/** % thay đổi so với kỳ trước; kỳ trước bằng 0 thì không so được */
export const changePercent = (current: number, previous: number): number | undefined =>
  previous > 0 ? Math.round(((current - previous) * 1000) / previous) / 10 : undefined

/** Tỉ lệ phần trăm, làm tròn 1 chữ số; mẫu bằng 0 thì 0 */
export const ratePercent = (part: number, total: number) => (total > 0 ? Math.round((part * 1000) / total) / 10 : 0)

/** Nút "Xuất Excel": dựng trang tính khi bấm rồi tải file về máy (FR-38) */
export function ExportButton({
  fileName,
  build,
  disabled,
}: {
  fileName: string
  build: () => ExcelSheet[]
  disabled?: boolean
}) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true)
        try {
          await exportExcel(fileName, build())
          toast.success(`Đã tải ${fileName}`)
        } catch (error) {
          toast.error(getErrorMessage(error, 'Không xuất được file Excel'))
        } finally {
          setPending(false)
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
      Xuất Excel
    </Button>
  )
}

/** Thẻ số liệu tổng của tab báo cáo (không có so sánh kỳ trước) */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'destructive' | 'success' | 'warning'
}) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-xs">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums',
          tone === 'destructive' && 'text-destructive',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning'
        )}
      >
        {value}
      </p>
      {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
    </div>
  )
}

/** Khung chờ tải chung: hàng thẻ và một khối bảng */
export function TabLoading({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải báo cáo">
      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

/** Dòng tiêu đề khối: tên bên trái, bộ lọc và nút xuất bên phải */
export function TabToolbar({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto text-base font-semibold">{title}</h2>
      {children}
    </div>
  )
}

/** Khung bảng cuộn ngang trên màn hình hẹp; `scroll` giới hạn chiều cao (bảng theo ngày dài tới 366 dòng) */
export function TableCard({
  children,
  minWidth = 760,
  scroll,
}: {
  children: React.ReactNode
  minWidth?: number
  scroll?: boolean
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className={cn('overflow-x-auto', scroll && 'max-h-[60vh] overflow-y-auto')}>
        <Table style={{ minWidth }}>{children}</Table>
      </div>
    </Card>
  )
}

/** Khung biểu đồ có tiêu đề */
export function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-3 p-4 sm:p-5">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      {children}
    </Card>
  )
}
