'use client'

import { Fragment, useMemo, useState } from 'react'
import { CalendarRange, Loader2, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { AffectedAppointment, ShiftType, StaffMemberDto } from '@/types/spa'
import { AffectedList } from '@/features/booking/components/AffectedList'
import { useBusinessHours, useUpdateShifts } from '@/features/booking/hooks/use-spa'
import { shiftLabels } from '@/features/booking/lib/labels'
import { problemAffected } from '@/features/booking/lib/problem'
import { bookingRules, shiftLabel } from '@/features/booking/lib/rules'
import { parseHhmm, weekdayLabel, weekdayShort } from '@/features/booking/lib/vn-time'
import { ShiftSelect, shiftTone } from './ShiftSelect'

const WEEK = [1, 2, 3, 4, 5, 6, 7]

/** Ca đang sửa của một KTV; `base` là ca đã lưu lúc bắt đầu sửa, máy chủ đổi khác thì bản nháp tự bỏ */
type Draft = { shifts: ShiftType[]; base: string; saved?: boolean }

const keyOf = (shifts: ShiftType[]) => shifts.join(',')

/**
 * Tab Lịch tuần (UC-02 bước 4–5, E1; FR-06, BR-04, BR-27): hàng là KTV đang làm, cột Thứ Hai → Chủ nhật, mỗi ô chọn ca.
 * Lưu từng hàng; trùng lịch hẹn đã có (409 LichBiAnhHuong) thì liệt kê lịch bị ảnh hưởng và giữ nguyên hàng đang sửa.
 */
export function WeeklyScheduleTab({
  staff,
  isLoading,
  error,
  onRetry,
}: {
  staff: StaffMemberDto[] | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { can } = usePermissions()
  const canUpdate = can(permissions.staffMembers.update)
  const hours = useBusinessHours()
  const updateShifts = useUpdateShifts()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [affected, setAffected] = useState<Record<string, AffectedAppointment[]>>({})

  const technicians = useMemo(
    () => (staff ?? []).filter((s) => s.kind === 'KyThuatVien' && s.isActive),
    [staff]
  )
  const open = hours.data ? parseHhmm(hours.data.openTime) : bookingRules.defaultOpen
  const close = hours.data ? parseHhmm(hours.data.closeTime) : bookingRules.defaultClose
  const savingId = updateShifts.isPending ? updateShifts.variables?.id : null

  const rowState = (m: StaffMemberDto) => {
    const serverShifts = m.shifts.length === 7 ? m.shifts : Array<ShiftType>(7).fill('Nghi')
    const serverKey = keyOf(serverShifts)
    const draft = drafts[m.id]
    const valid = !!draft && draft.base === serverKey
    const shifts = valid ? draft.shifts : serverShifts
    return {
      serverShifts,
      serverKey,
      shifts,
      dirty: valid && !draft.saved && keyOf(draft.shifts) !== serverKey,
    }
  }

  const clearAffected = (id: string) =>
    setAffected((a) => {
      if (!(id in a)) return a
      const next = { ...a }
      delete next[id]
      return next
    })

  const setCell = (m: StaffMemberDto, day: number, value: ShiftType) => {
    const { shifts, serverKey } = rowState(m)
    const next = shifts.map((s, i) => (i === day ? value : s))
    setDrafts((d) => ({ ...d, [m.id]: { shifts: next, base: serverKey } }))
  }

  const reset = (m: StaffMemberDto) => {
    setDrafts((d) => {
      const next = { ...d }
      delete next[m.id]
      return next
    })
    clearAffected(m.id)
  }

  const save = (m: StaffMemberDto) => {
    const { shifts } = rowState(m)
    updateShifts.mutate(
      { id: m.id, shifts },
      {
        onSuccess: () => {
          setDrafts((d) => (d[m.id] ? { ...d, [m.id]: { ...d[m.id], saved: true } } : d))
          clearAffected(m.id)
          toast.success(`Đã lưu lịch tuần của ${m.fullName}`)
        },
        onError: (err) => {
          // Giữ nguyên bản nháp để chủ tiệm chuyển KTV hoặc hủy các lịch rồi lưu lại
          const list = problemAffected(err)
          if (list.length) setAffected((a) => ({ ...a, [m.id]: list }))
          toast.error(getErrorMessage(err))
        },
      }
    )
  }

  const legend = (['Sang', 'Chieu', 'CaNgay'] as ShiftType[]).map((s) => {
    const text = shiftLabel(s, open, close)
    return { shift: s, text: text.charAt(0).toUpperCase() + text.slice(1) }
  })

  const dirtyCount = technicians.filter((m) => rowState(m).dirty).length

  return (
    <div className="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {legend.map((l) => (
            <span
              key={l.shift}
              className={cn('rounded-md px-2 py-1 font-medium tabular-nums', shiftTone[l.shift])}
            >
              {l.text}
            </span>
          ))}
          <span className={cn('rounded-md px-2 py-1 font-medium', shiftTone.Nghi)}>Nghỉ</span>
        </div>
        <p className="text-muted-foreground text-sm sm:ml-auto">
          {canUpdate
            ? dirtyCount > 0
              ? `${dirtyCount} kỹ thuật viên có thay đổi chưa lưu`
              : 'Chọn ca từng thứ rồi bấm Lưu ở cuối hàng.'
            : 'Chỉ chủ tiệm đổi được lịch tuần.'}
        </p>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <div className="overflow-x-auto" aria-busy={isLoading}>
          <Table style={{ minWidth: 1100 }}>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground h-11 w-56 px-4 text-xs font-semibold tracking-wide uppercase">
                  Kỹ thuật viên
                </TableHead>
                {WEEK.map((d) => (
                  <TableHead
                    key={d}
                    className="text-muted-foreground h-11 px-2 text-center text-xs font-semibold tracking-wide uppercase"
                  >
                    <span className="hidden xl:inline">{weekdayLabel(d)}</span>
                    <span className="xl:hidden" aria-label={weekdayLabel(d)}>
                      {weekdayShort(d)}
                    </span>
                  </TableHead>
                ))}
                {canUpdate && (
                  <TableHead className="h-11 w-36 px-4">
                    <span className="sr-only">Lưu</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                      <TableCell className="h-14 px-4">
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      {WEEK.map((d) => (
                        <TableCell key={d} className="px-2">
                          <Skeleton className="mx-auto h-9 w-24" />
                        </TableCell>
                      ))}
                      {canUpdate && <TableCell />}
                    </TableRow>
                  ))
                : technicians.map((m) => {
                    const { shifts, serverShifts, dirty } = rowState(m)
                    const saving = savingId === m.id
                    const rowAffected = affected[m.id] ?? []
                    const workDays = shifts.filter((s) => s !== 'Nghi').length
                    return (
                      <Fragment key={m.id}>
                        <TableRow
                          className={cn(
                            'hover:bg-muted/40 transition-colors duration-150',
                            dirty && 'bg-primary/[0.03]'
                          )}
                        >
                          <TableCell className="px-4 py-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="ring-border size-3 shrink-0 rounded-full ring-1"
                                style={{ backgroundColor: m.color }}
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{m.fullName}</p>
                                <p className="text-muted-foreground text-xs">
                                  <span className="font-mono">{m.code}</span> · {workDays} ngày làm
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          {shifts.map((shift, day) => (
                            <TableCell key={day} className="px-2 py-2 text-center">
                              {canUpdate ? (
                                <ShiftSelect
                                  value={shift}
                                  changed={shift !== serverShifts[day]}
                                  disabled={saving}
                                  aria-label={`Ca ${weekdayLabel(day + 1)} của ${m.fullName}`}
                                  onChange={(v) => setCell(m, day, v)}
                                  className="mx-auto w-full max-w-28"
                                />
                              ) : (
                                <span
                                  className={cn(
                                    'inline-flex h-8 min-w-20 items-center justify-center rounded-md px-2 text-sm font-medium',
                                    shiftTone[shift]
                                  )}
                                >
                                  {shiftLabels[shift]}
                                </span>
                              )}
                            </TableCell>
                          ))}
                          {canUpdate && (
                            <TableCell className="px-4 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {dirty && (
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Hoàn tác lịch của ${m.fullName}`}
                                    title="Hoàn tác"
                                    disabled={saving}
                                    onClick={() => reset(m)}
                                  >
                                    <RotateCcw />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant={dirty ? 'default' : 'outline'}
                                  disabled={!dirty || saving}
                                  onClick={() => save(m)}
                                >
                                  {saving ? (
                                    <Loader2 className="animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Save aria-hidden="true" />
                                  )}
                                  Lưu
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        {rowAffected.length > 0 && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell
                              colSpan={canUpdate ? 9 : 8}
                              className="px-4 pt-0 pb-3 whitespace-normal"
                            >
                              <AffectedList items={rowAffected} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
            </TableBody>
          </Table>
          {!isLoading && technicians.length === 0 && (
            <EmptyState
              icon={CalendarRange}
              title="Chưa có kỹ thuật viên đang làm"
              description="Thêm kỹ thuật viên ở tab Nhân viên rồi xếp ca tại đây."
            />
          )}
        </div>
      )}
    </div>
  )
}
