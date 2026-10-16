'use client'

import { useState } from 'react'
import { Clock, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import type { AffectedAppointment, BusinessHoursDto, ShiftType } from '@/types/spa'
import { AffectedList } from '@/features/booking/components/AffectedList'
import { useBusinessHours, useUpdateHours } from '@/features/booking/hooks/use-spa'
import { problemAffected } from '@/features/booking/lib/problem'
import { bookingRules, shiftLabel } from '@/features/booking/lib/rules'
import { hhmm, parseHhmm } from '@/features/booking/lib/vn-time'

/** Mốc giờ chọn được, bước 15 phút (BR-01); đóng cửa muộn nhất 23:00 */
const EARLIEST = 6 * 60
const LATEST = 23 * 60
const MIN_OPEN_MINUTES = 240
const TIMES = Array.from({ length: (LATEST - EARLIEST) / bookingRules.slotStep + 1 }, (_, i) =>
  hhmm(EARLIEST + i * bookingRules.slotStep)
)

/**
 * Tab Giờ mở cửa (UC-02 1b, E1; FR-07, BR-01): đổi giờ mở, giờ đóng; lịch tương lai rơi ra ngoài giờ mới
 * (409 LichBiAnhHuong) thì liệt kê lịch bị ảnh hưởng, không lưu. Ngày tiệm nghỉ khai báo ở tab Ngày nghỉ.
 */
export function BusinessHoursTab() {
  const hours = useBusinessHours()

  return (
    <div className="bg-card text-card-foreground max-w-3xl rounded-xl border shadow-xs">
      <div className="flex items-start gap-3 border-b p-4">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Clock className="size-4.5" aria-hidden="true" />
        </span>
        <div className="space-y-0.5">
          <h2 className="font-semibold">Giờ mở cửa</h2>
          <p className="text-muted-foreground text-sm">
            Áp dụng mọi ngày trong tuần. Mọi dịch vụ bắt đầu từ giờ mở cửa và kết thúc chậm nhất lúc
            đóng cửa; ngày tiệm nghỉ (lễ, Tết) khai báo ở tab Ngày nghỉ, chọn &quot;Cả tiệm
            nghỉ&quot;.
          </p>
        </div>
      </div>
      {hours.isLoading ? (
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : hours.error ? (
        <ErrorState error={hours.error} onRetry={() => void hours.refetch()} />
      ) : hours.data ? (
        <HoursForm key={`${hours.data.openTime}-${hours.data.closeTime}`} initial={hours.data} />
      ) : null}
    </div>
  )
}

function HoursForm({ initial }: { initial: BusinessHoursDto }) {
  const { can } = usePermissions()
  const canUpdate = can(permissions.staffMembers.update)
  const save = useUpdateHours()
  const [openTime, setOpenTime] = useState(initial.openTime)
  const [closeTime, setCloseTime] = useState(initial.closeTime)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [affected, setAffected] = useState<AffectedAppointment[]>([])

  const open = parseHhmm(openTime)
  const close = parseHhmm(closeTime)
  const dirty = openTime !== initial.openTime || closeTime !== initial.closeTime
  const options = (current: string) => (TIMES.includes(current) ? TIMES : [current, ...TIMES])

  const change = (field: 'openTime' | 'closeTime', value: string) => {
    if (field === 'openTime') setOpenTime(value)
    else setCloseTime(value)
    setErrors({})
    setAffected([])
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (close - open < MIN_OPEN_MINUTES) {
      setErrors({ closeTime: 'Tiệm mở cửa tối thiểu 4 giờ mỗi ngày' })
      return
    }
    setErrors({})
    setAffected([])
    save.mutate(
      { openTime, closeTime },
      {
        onSuccess: (saved) =>
          toast.success(`Đã lưu giờ mở cửa ${saved.openTime}–${saved.closeTime}`),
        onError: (err) => {
          const list = problemAffected(err)
          if (list.length) {
            setAffected(list)
            toast.error(getErrorMessage(err))
            return
          }
          const fields = getFieldErrors(err)
          if (Object.keys(fields).length) setErrors(fields)
          else toast.error(getErrorMessage(err))
        },
      }
    )
  }

  const preview =
    close > open
      ? (['Sang', 'Chieu', 'CaNgay'] as ShiftType[]).map((s) => shiftLabel(s, open, close))
      : []

  return (
    <form onSubmit={submit} noValidate className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Giờ mở cửa" required error={errors.openTime} htmlFor="hours-open">
          <Select
            value={openTime}
            disabled={!canUpdate || save.isPending}
            onValueChange={(v) => change('openTime', v)}
          >
            <SelectTrigger
              id="hours-open"
              className="tabular-nums"
              aria-invalid={errors.openTime ? true : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {options(openTime).map((t) => (
                <SelectItem key={t} value={t} className="tabular-nums">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Giờ đóng cửa"
          required
          error={errors.closeTime}
          htmlFor="hours-close"
          hint="Muộn nhất 23:00, mở tối thiểu 4 giờ"
        >
          <Select
            value={closeTime}
            disabled={!canUpdate || save.isPending}
            onValueChange={(v) => change('closeTime', v)}
          >
            <SelectTrigger
              id="hours-close"
              className="tabular-nums"
              aria-invalid={errors.closeTime ? true : undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {options(closeTime).map((t) => (
                <SelectItem key={t} value={t} className="tabular-nums">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {preview.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Khung ca theo giờ này:{' '}
          <span className="text-foreground tabular-nums">{preview.join(' · ')}</span>
        </p>
      )}

      <AffectedList items={affected} />

      {canUpdate ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && (
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => {
                setOpenTime(initial.openTime)
                setCloseTime(initial.closeTime)
                setErrors({})
                setAffected([])
              }}
            >
              Hoàn tác
            </Button>
          )}
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            Lưu giờ mở cửa
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Chỉ chủ tiệm đổi được giờ mở cửa.</p>
      )}
    </form>
  )
}
