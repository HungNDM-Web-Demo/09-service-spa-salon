'use client'

import { Loader2, Package, UserCheck, UserPlus } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/input'
import { formatPhone } from '@/lib/format'
import type { CustomerLookupDto } from '@/types/spa'
import { PHONE_PATTERN, digitsOnly } from '../lib/rules'
import { ddmmyyyy } from '../lib/vn-time'
import { FlaggedBadge } from './SpaBadges'

type CustomerPickerProps = {
  phone: string
  onPhoneChange: (value: string) => void
  /** Họ tên khi thêm nhanh khách mới */
  newName: string
  onNewNameChange: (value: string) => void
  lookup: CustomerLookupDto | undefined
  isLooking: boolean
  errors?: { phone?: string; name?: string }
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Nhập số điện thoại để tìm hồ sơ khách (UC-03 bước 3, UC-09 bước 2): hiện tên, ghi chú da, gói đang có,
 * nhãn "Hay bỏ hẹn"; chưa có hồ sơ thì nhập tên để thêm nhanh (BR-28).
 */
export function CustomerPicker({
  phone,
  onPhoneChange,
  newName,
  onNewNameChange,
  lookup,
  isLooking,
  errors = {},
  disabled,
  autoFocus,
}: CustomerPickerProps) {
  const digits = digitsOnly(phone)
  const valid = PHONE_PATTERN.test(digits)
  const customer = lookup?.customer ?? null
  const activePackages = (lookup?.packages ?? []).filter((p) => p.status === 'DangDung')
  const phoneError = errors.phone ?? (digits.length >= 10 && !valid ? 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' : undefined)

  return (
    <div className="space-y-3">
      <FormField label="Số điện thoại khách" required error={phoneError}>
        <div className="relative">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            autoFocus={autoFocus}
            placeholder="0903 123 456"
            value={phone}
            disabled={disabled}
            onChange={(e) => onPhoneChange(e.target.value.replace(/[^\d\s]/g, '').slice(0, 13))}
            className="pr-9 tabular-nums"
          />
          {isLooking && (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" aria-hidden="true" />
          )}
        </div>
      </FormField>

      {valid && !isLooking && customer && (
        <div className="bg-muted/50 space-y-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <UserCheck className="text-success size-4" aria-hidden="true" />
            <span className="font-semibold">{customer.fullName}</span>
            <span className="text-muted-foreground tabular-nums">
              {customer.code} · {formatPhone(customer.phone)}
            </span>
            {customer.isFlagged && <FlaggedBadge count={customer.noShowCount90} />}
          </div>
          {customer.isFlagged && (
            <p className="text-warning text-[0.8125rem]">
              Khách không đến {customer.noShowCount90} lần trong 90 ngày. Nên gọi xác nhận trước giờ hẹn.
            </p>
          )}
          {customer.note && <p className="text-muted-foreground">Ghi chú: {customer.note}</p>}
          {activePackages.length > 0 && (
            <ul className="space-y-1">
              {activePackages.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Package className="text-primary size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    {p.packageName}: còn <b className="tabular-nums">{p.remaining}</b>/{p.totalSessions} buổi, hạn{' '}
                    {ddmmyyyy(p.expiryDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {valid && !isLooking && lookup && !customer && (
        <div className="space-y-2">
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <UserPlus className="size-4" aria-hidden="true" />
            Khách mới, nhập họ tên để thêm hồ sơ
          </p>
          <FormField label="Họ tên khách" required error={errors.name}>
            <Input value={newName} disabled={disabled} maxLength={100} onChange={(e) => onNewNameChange(e.target.value)} />
          </FormField>
        </div>
      )}
    </div>
  )
}
