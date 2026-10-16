'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatPhone } from '@/lib/format'
import { matchesSearch } from '@/lib/normalize'
import type { AffectedAppointment, StaffMemberDto } from '@/types/spa'
import { AffectedList } from '@/features/booking/components/AffectedList'
import { useDeleteStaff, useSetStaffActive } from '@/features/booking/hooks/use-spa'
import { staffKindLabels } from '@/features/booking/lib/labels'
import { problemAffected, problemCode } from '@/features/booking/lib/problem'
import { StaffFormDialog, type StaffDialogTarget } from './StaffFormDialog'

type StatusFilter = 'active' | 'inactive' | 'all'

/**
 * Tab Nhân viên (UC-02 luồng chính, 1c, 2a, E2): mã, họ tên, số điện thoại, loại, màu, chuyên môn, số dịch vụ làm được,
 * tài khoản liên kết, trạng thái; thêm, sửa, chuyển nghỉ việc, xóa.
 */
export function StaffListTab({
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
  const canCreate = can(permissions.staffMembers.create)
  const canUpdate = can(permissions.staffMembers.update)
  const canDelete = can(permissions.staffMembers.delete)
  const setActive = useSetStaffActive()
  const remove = useDeleteStaff()

  const [search, setSearch] = useState('')
  const [searchKey, setSearchKey] = useState(0)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [dialog, setDialog] = useState<StaffDialogTarget | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<StaffMemberDto | null>(null)
  const [leaveAffected, setLeaveAffected] = useState<AffectedAppointment[]>([])
  const [deleteTarget, setDeleteTarget] = useState<StaffMemberDto | null>(null)

  const rows = useMemo(
    () =>
      (staff ?? []).filter(
        (s) =>
          (status === 'all' || s.isActive === (status === 'active')) &&
          matchesSearch(`${s.code} ${s.fullName} ${s.phone} ${s.specialty ?? ''}`, search)
      ),
    [staff, status, search]
  )

  const openLeave = (s: StaffMemberDto) => {
    setLeaveAffected([])
    setLeaveTarget(s)
  }

  const reactivate = (s: StaffMemberDto) =>
    setActive.mutate(
      { id: s.id, isActive: true },
      {
        onSuccess: () => toast.success(`${s.fullName} đã đi làm lại`),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )

  const confirmLeave = async () => {
    if (!leaveTarget) return
    try {
      await setActive.mutateAsync({ id: leaveTarget.id, isActive: false })
      toast.success(`${leaveTarget.fullName} đã chuyển nghỉ việc`)
    } catch (err) {
      // UC-02 E2: còn lịch tương lai thì từ chối, hiện số lịch và danh sách để chuyển KTV
      setLeaveAffected(problemAffected(err))
      toast.error(getErrorMessage(err))
      throw err
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await remove.mutateAsync(target.id)
      toast.success(`Đã xóa nhân viên ${target.fullName}`)
    } catch (err) {
      // BR-27: đã phát sinh lịch hẹn, hoa hồng thì không xóa được, gợi ý Nghỉ việc
      if (problemCode(err) === 'DaPhatSinh') {
        toast.error(
          getErrorMessage(err),
          target.isActive && canUpdate
            ? { action: { label: 'Chuyển nghỉ việc', onClick: () => openLeave(target) } }
            : undefined
        )
        return
      }
      toast.error(getErrorMessage(err))
      throw err
    }
  }

  const columns: ColumnDef<StaffMemberDto>[] = [
    {
      id: 'code',
      header: 'Mã',
      meta: { className: 'w-20 font-mono text-xs' },
      cell: ({ row }) => row.original.code,
    },
    {
      id: 'fullName',
      header: 'Họ tên',
      cell: ({ row }) => {
        const s = row.original
        return (
          <div className="flex items-center gap-3">
            <span
              className="ring-border size-3.5 shrink-0 rounded-full ring-1"
              style={{ backgroundColor: s.color }}
              title={`Màu trên lịch ${s.color}`}
              aria-hidden="true"
            />
            <div className="max-w-64 min-w-0">
              {canUpdate ? (
                <button
                  type="button"
                  onClick={() => setDialog({ member: s })}
                  className="focus-visible:ring-ring/50 cursor-pointer rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3"
                >
                  {s.fullName}
                </button>
              ) : (
                <p className="font-medium">{s.fullName}</p>
              )}
              {s.specialty && (
                <p className="text-muted-foreground truncate text-xs" title={s.specialty}>
                  {s.specialty}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'phone',
      header: 'Số điện thoại',
      meta: { className: 'tabular-nums whitespace-nowrap' },
      cell: ({ row }) => formatPhone(row.original.phone),
    },
    {
      id: 'kind',
      header: 'Loại',
      cell: ({ row }) => (
        <StatusBadge tone={row.original.kind === 'KyThuatVien' ? 'primary' : 'info'} dot={false}>
          {staffKindLabels[row.original.kind]}
        </StatusBadge>
      ),
    },
    {
      id: 'services',
      header: 'Dịch vụ làm được',
      meta: { className: 'tabular-nums' },
      cell: ({ row }) =>
        row.original.kind === 'KyThuatVien' ? (
          row.original.serviceIds.length > 0 ? (
            `${row.original.serviceIds.length} dịch vụ`
          ) : (
            <span className="text-warning font-medium">Chưa chọn</span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'username',
      header: 'Tài khoản',
      cell: ({ row }) =>
        row.original.username ? (
          <span className="font-mono text-xs">{row.original.username}</span>
        ) : (
          <span className="text-muted-foreground text-sm">Chưa liên kết</span>
        ),
    },
    {
      id: 'isActive',
      header: 'Trạng thái',
      cell: ({ row }) =>
        row.original.isActive ? (
          <StatusBadge tone="success">Đang làm</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Nghỉ việc</StatusBadge>
        ),
    },
  ]
  if (canUpdate || canDelete) {
    columns.push({
      id: 'actions',
      header: () => <span className="sr-only">Thao tác</span>,
      meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
      cell: ({ row }) => {
        const s = row.original
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Thao tác với ${s.fullName}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">
                {s.fullName}
              </DropdownMenuLabel>
              {canUpdate && (
                <>
                  <DropdownMenuItem className="h-9" onSelect={() => setDialog({ member: s })}>
                    <Pencil aria-hidden="true" /> Sửa hồ sơ
                  </DropdownMenuItem>
                  {s.isActive ? (
                    <DropdownMenuItem className="h-9" onSelect={() => openLeave(s)}>
                      <UserX aria-hidden="true" /> Nghỉ việc
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem className="h-9" onSelect={() => reactivate(s)}>
                      <UserCheck aria-hidden="true" /> Đi làm lại
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="h-9"
                    onSelect={() => setDeleteTarget(s)}
                  >
                    <Trash2 aria-hidden="true" /> Xóa nhân viên
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  const filtering = !!search || status !== 'all'

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(s) => s.id}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        minWidth={960}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              key={searchKey}
              onSearch={setSearch}
              placeholder="Tìm theo mã, tên, số điện thoại…"
            />
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Lọc theo trạng thái">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Đang làm</SelectItem>
                <SelectItem value="inactive">Nghỉ việc</SelectItem>
              </SelectContent>
            </Select>
            {canCreate && (
              <Button className="sm:ml-auto" onClick={() => setDialog({ member: null })}>
                <Plus aria-hidden="true" />
                Thêm nhân viên
              </Button>
            )}
          </div>
        }
        emptyState={
          filtering ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy nhân viên"
              description="Thử từ khóa khác hoặc chọn tất cả trạng thái."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setSearchKey((k) => k + 1)
                    setStatus('all')
                  }}
                >
                  Xóa bộ lọc
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={UserCog}
              title="Chưa có nhân viên"
              description="Thêm kỹ thuật viên để xếp ca và nhận lịch hẹn."
              action={
                canCreate && (
                  <Button onClick={() => setDialog({ member: null })}>
                    <Plus aria-hidden="true" />
                    Thêm nhân viên
                  </Button>
                )
              }
            />
          )
        }
      />

      <StaffFormDialog target={dialog} onOpenChange={(o) => !o && setDialog(null)} />

      <ConfirmDialog
        open={!!leaveTarget}
        onOpenChange={(o) => {
          if (o) return
          setLeaveTarget(null)
          setLeaveAffected([])
        }}
        variant="destructive"
        icon={UserX}
        title={`Chuyển ${leaveTarget?.fullName ?? ''} sang nghỉ việc?`}
        description="Nhân viên không còn trên lưới lịch hẹn và trang đặt online; lịch sử, hoa hồng cũ giữ nguyên. Còn lịch hẹn sắp tới thì phải chuyển kỹ thuật viên hoặc hủy trước."
        confirmText="Nghỉ việc"
        loading={setActive.isPending}
        onConfirm={confirmLeave}
      >
        <AffectedList items={leaveAffected} />
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title={`Xóa nhân viên ${deleteTarget?.fullName ?? ''}?`}
        description="Chỉ xóa được nhân viên chưa có lịch hẹn, hóa đơn hay hoa hồng. Nhân viên đã làm việc thì chuyển Nghỉ việc để giữ lịch sử."
        confirmText="Xóa nhân viên"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
