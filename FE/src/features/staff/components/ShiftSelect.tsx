'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ShiftType } from '@/types/spa'
import { shiftLabels, shiftOptions } from '@/features/booking/lib/labels'

/** Nền nhạt theo ca để nhìn lướt ma trận lịch tuần; luôn kèm chữ */
export const shiftTone: Record<ShiftType, string> = {
  Sang: 'bg-info/10 text-foreground',
  Chieu: 'bg-warning/10 text-foreground',
  CaNgay: 'bg-primary/10 text-foreground',
  Nghi: 'bg-muted text-muted-foreground',
}

type ShiftSelectProps = {
  value: ShiftType
  onChange: (value: ShiftType) => void
  disabled?: boolean
  /** Ô đã đổi so với dữ liệu đã lưu */
  changed?: boolean
  className?: string
  'aria-label': string
}

/** Chọn ca một ngày: Sáng, Chiều, Cả ngày, Nghỉ (FR-06, BR-04). */
export function ShiftSelect({
  value,
  onChange,
  disabled,
  changed,
  className,
  ...props
}: ShiftSelectProps) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(v) => onChange(v as ShiftType)}>
      <SelectTrigger
        aria-label={props['aria-label']}
        className={cn(
          'h-9 min-w-24 font-medium',
          shiftTone[value],
          changed && 'border-primary ring-primary/30 ring-2',
          className
        )}
      >
        <SelectValue>{shiftLabels[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {shiftOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
