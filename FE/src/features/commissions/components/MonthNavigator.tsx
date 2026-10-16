'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { currentMonth, isMonth, monthDisplay, shiftMonth } from '../lib/month'

/**
 * Chọn tháng "yyyy-MM": nút tháng trước, tháng sau (không vượt tháng hiện tại), "Tháng này".
 * `picker`: ô chọn tháng cho màn hình rộng (chủ tiệm xem bảng cũ, UC-11 1a); không có thì hiện chữ "Tháng 10/2026" (điện thoại).
 */
export function MonthNavigator({
  value,
  onChange,
  picker,
  className,
}: {
  value: string
  onChange: (month: string) => void
  picker?: boolean
  className?: string
}) {
  const max = currentMonth()
  const isCurrent = value >= max
  const size = picker ? 'icon' : 'icon-lg'

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button variant="outline" size={size} aria-label="Tháng trước" onClick={() => onChange(shiftMonth(value, -1))}>
        <ChevronLeft />
      </Button>
      {picker ? (
        <Input
          type="month"
          value={value}
          max={max}
          aria-label="Chọn tháng"
          onChange={(e) => isMonth(e.target.value) && onChange(e.target.value > max ? max : e.target.value)}
          className="w-44"
        />
      ) : (
        <p className="min-w-0 flex-1 text-center text-base font-semibold tabular-nums" aria-live="polite">
          Tháng {monthDisplay(value)}
        </p>
      )}
      <Button variant="outline" size={size} aria-label="Tháng sau" disabled={isCurrent} onClick={() => onChange(shiftMonth(value, 1))}>
        <ChevronRight />
      </Button>
      {!isCurrent && (
        <Button variant="ghost" size={picker ? 'default' : 'lg'} onClick={() => onChange(max)}>
          Tháng này
        </Button>
      )}
    </div>
  )
}
