'use client'

import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type MoneyInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  /** Đơn vị hiện cuối ô, mặc định "₫" */
  suffix?: string
}

/** Ô nhập số tiền có dấu chấm ngăn nghìn ("1.250.000"), bàn phím số trên tablet. */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, suffix = '₫', className, ...props },
  ref
) {
  const text = value === null || value === undefined ? '' : value.toLocaleString('vi-VN')
  return (
    <div className="relative">
      <Input
        ref={ref}
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
          onValueChange(digits === '' ? null : Number(digits))
        }}
        className={cn('pr-8 text-right tabular-nums', className)}
        {...props}
      />
      {suffix && (
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
          {suffix}
        </span>
      )}
    </div>
  )
})
