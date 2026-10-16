'use client'

import { useMemo } from 'react'
import { Banknote, CreditCard, QrCode } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/types/spa'
import { useStoreProfile } from '../hooks/use-spa'
import { buildVietQr } from '../lib/vietqr'
import { MoneyInput } from './MoneyInput'
import { QrImage } from './QrImage'

export type PaymentState = {
  method: PaymentMethod
  cashReceived: number | null
  cardAuthCode: string
  /** Lễ tân bấm "Đã nhận tiền" sau khi khách quét QR (FR-25) */
  transferConfirmed: boolean
}

export const initialPayment = (total: number): PaymentState => ({
  method: 'TienMat',
  cashReceived: total,
  cardAuthCode: '',
  transferConfirmed: false,
})

/** Đủ điều kiện bấm "Hoàn tất" phía giao diện (BR-17); máy chủ kiểm lại */
export function paymentReady(total: number, p: PaymentState): boolean {
  if (total <= 0) return true
  if (p.method === 'TienMat') return (p.cashReceived ?? 0) >= total
  if (p.method === 'The') return /^\d{6}$/.test(p.cardAuthCode)
  if (p.method === 'ChuyenKhoan') return p.transferConfirmed
  return false
}

/** Nút mệnh giá nhanh: đúng số tiền, rồi làm tròn lên các mốc 50.000/100.000/500.000 */
function quickAmounts(total: number): number[] {
  const steps = [10_000, 50_000, 100_000, 200_000, 500_000, 1_000_000]
  const list = [total, ...steps.map((s) => Math.ceil(total / s) * s)]
  return [...new Set(list)].filter((v) => v >= total).slice(0, 4)
}

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'TienMat', label: 'Tiền mặt', icon: Banknote },
  { value: 'ChuyenKhoan', label: 'Chuyển khoản', icon: QrCode },
  { value: 'The', label: 'Thẻ', icon: CreditCard },
]

type PaymentPanelProps = {
  total: number
  value: PaymentState
  onChange: (next: PaymentState) => void
  /** Nội dung chuyển khoản trên QR (mã lịch hẹn hoặc SĐT khách) */
  transferContent: string
  errors?: Record<string, string>
  disabled?: boolean
}

/** Chọn phương thức và thu tiền (UC-08 bước 6, UC-09 bước 4). Tổng 0 ₫ thì không cần thu (BR-15). */
export function PaymentPanel({ total, value, onChange, transferContent, errors = {}, disabled }: PaymentPanelProps) {
  const store = useStoreProfile()
  const qr = useMemo(() => {
    if (value.method !== 'ChuyenKhoan' || !store.data?.bankBin || !store.data.bankAccount || total <= 0) return null
    return buildVietQr({ bankBin: store.data.bankBin, bankAccount: store.data.bankAccount, amount: total, content: transferContent })
  }, [value.method, store.data, total, transferContent])

  if (total <= 0)
    return (
      <p className="bg-success/10 text-success rounded-lg px-3 py-2.5 text-sm font-medium">
        Tổng 0 ₫ vì mọi dòng đều trừ buổi gói, không cần thu tiền.
      </p>
    )

  const set = (patch: Partial<PaymentState>) => onChange({ ...value, ...patch })
  const change = (value.cashReceived ?? 0) - total

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Phương thức thanh toán" className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => {
          const active = value.method === m.value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => set({ method: m.value })}
              className={cn(
                'flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors',
                'focus-visible:ring-ring/50 outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
                active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
              )}
            >
              <m.icon className="size-4" aria-hidden="true" />
              {m.label}
            </button>
          )
        })}
      </div>

      {value.method === 'TienMat' && (
        <div className="space-y-2">
          <FormField label="Tiền khách đưa" error={errors.cashReceived}>
            <MoneyInput value={value.cashReceived} onValueChange={(v) => set({ cashReceived: v })} disabled={disabled} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {quickAmounts(total).map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={disabled}
                onClick={() => set({ cashReceived: amount })}
                className={cn(
                  'h-9 cursor-pointer rounded-md border px-3 text-sm tabular-nums transition-colors',
                  value.cashReceived === amount ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'
                )}
              >
                {formatVnd(amount)}
              </button>
            ))}
          </div>
          <p className={cn('text-sm', change >= 0 ? 'text-muted-foreground' : 'text-destructive font-medium')}>
            {change >= 0 ? (
              <>
                Tiền thối: <span className="text-foreground font-semibold tabular-nums">{formatVnd(change)}</span>
              </>
            ) : (
              <>Còn thiếu {formatVnd(-change)}</>
            )}
          </p>
        </div>
      )}

      {value.method === 'ChuyenKhoan' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border p-3 sm:flex-row sm:items-start">
          {qr ? <QrImage value={qr} size={168} /> : <div className="bg-muted size-[168px] rounded-md" />}
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p className="text-muted-foreground">QR giả lập theo chuẩn VietQR, không chuyển được tiền thật.</p>
            <p>
              Tài khoản: <span className="font-medium tabular-nums">{store.data?.bankAccount || '—'}</span>
            </p>
            <p>
              Chủ tài khoản: <span className="font-medium">{store.data?.bankAccountName || '—'}</span>
            </p>
            <p>
              Số tiền: <span className="font-semibold tabular-nums">{formatVnd(total)}</span>
            </p>
            <p>
              Nội dung: <span className="font-medium tabular-nums">{transferContent}</span>
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="transfer-confirmed"
                checked={value.transferConfirmed}
                disabled={disabled}
                onCheckedChange={(c) => set({ transferConfirmed: c === true })}
              />
              <Label htmlFor="transfer-confirmed" className="cursor-pointer">
                Đã nhận tiền
              </Label>
            </div>
          </div>
        </div>
      )}

      {value.method === 'The' && (
        <FormField label="Mã chuẩn chi" hint="6 chữ số in trên hóa đơn máy POS" error={errors.cardAuthCode}>
          <Input
            inputMode="numeric"
            maxLength={6}
            value={value.cardAuthCode}
            disabled={disabled}
            onChange={(e) => set({ cardAuthCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            className="tabular-nums"
          />
        </FormField>
      )}
    </div>
  )
}
