'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarOff, Plus, Store, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import type { DayOffDto, StaffMemberDto } from '@/types/spa'
import { useDaysOff, useDeleteDayOff } from '@/features/booking/hooks/use-spa'
import { ddmmyyyy, isoWeekdayOf, vnToday, weekdayLabel } from '@/features/booking/lib/vn-time'
import { DayOffFormDialog } from './DayOffFormDialog'

/**
 * Tab Ngày nghỉ (UC-02 1a, 1b, E1; FR-06, FR-07): ngày nghỉ đột xuất của KTV và ngày cả tiệm nghỉ từ hôm nay trở đi.
 * Thêm, xóa cần quyền `staff-members.update` (07 §4.3).
 */
export function DaysOffTab({ staff }: { staff: StaffMemberDto[] | undefined }) {
  const { can } = usePermissions()
  const canUpdate = can(permissions.staffMembers.update)
  const today = vnToday()
  const daysOff = useDaysOff({ from: today })
  const remove = useDeleteDayOff()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DayOffDto | null>(null)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa ngày nghỉ ${ddmmyyyy(deleteTarget.date)}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
      throw err
    }
  }

  const columns: ColumnDef<DayOffDto>[] = [
    {
      id: 'date',
      header: 'Ngày',
      meta: { className: 'w-48' },
      cell: ({ row }) => {
        const d = row.original.date
        return (
          <div>
            <p className="font-medium tabular-nums">{ddmmyyyy(d)}</p>
            <p className="text-muted-foreground text-xs">
              {weekdayLabel(isoWeekdayOf(d))}
              {d === today && ' · hôm nay'}
            </p>
          </div>
        )
      },
    },
    {
      id: 'staff',
      header: 'Áp dụng cho',
      cell: ({ row }) =>
        row.original.staffMemberId ? (
          <span className="font-medium">{row.original.staffName ?? '—'}</span>
        ) : (
          <StatusBadge tone="warning" icon={<Store className="size-3" aria-hidden="true" />}>
            Cả tiệm nghỉ
          </StatusBadge>
        ),
    },
    {
      id: 'reason',
      header: 'Lý do',
      meta: { className: 'whitespace-normal' },
      cell: ({ row }) => row.original.reason,
    },
  ]
  if (canUpdate) {
    columns.push({
      id: 'actions',
      header: () => <span className="sr-only">Thao tác</span>,
      meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={`Xóa ngày nghỉ ${ddmmyyyy(row.original.date)}`}
          onClick={() => setDeleteTarget(row.original)}
        >
          <Trash2 />
        </Button>
      ),
    })
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={daysOff.data}
        getRowId={(d) => d.id}
        isLoading={daysOff.isLoading}
        isFetching={daysOff.isFetching}
        error={daysOff.error}
        onRetry={() => void daysOff.refetch()}
        minWidth={640}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Ngày nghỉ từ hôm nay trở đi. KTV nghỉ thì không nhận lịch ngày đó; cả tiệm nghỉ (lễ,
              Tết) thì không đặt được lịch.
            </p>
            {canUpdate && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus aria-hidden="true" />
                Thêm ngày nghỉ
              </Button>
            )}
          </div>
        }
        emptyState={
          <EmptyState
            icon={CalendarOff}
            title="Chưa có ngày nghỉ sắp tới"
            description="Đăng ký ngày nghỉ đột xuất của kỹ thuật viên hoặc ngày cả tiệm nghỉ."
          />
        }
      />

      <DayOffFormDialog open={formOpen} onOpenChange={setFormOpen} staff={staff ?? []} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title={`Xóa ngày nghỉ ${deleteTarget ? ddmmyyyy(deleteTarget.date) : ''}?`}
        description={
          deleteTarget?.staffMemberId
            ? `${deleteTarget.staffName ?? 'Kỹ thuật viên'} sẽ nhận lịch lại theo ca tuần vào ngày này.`
            : 'Tiệm sẽ nhận lịch lại vào ngày này theo giờ mở cửa.'
        }
        confirmText="Xóa ngày nghỉ"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
