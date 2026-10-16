'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, FolderTree, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
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
import type { ServiceGroupDto } from '@/types/spa'
import { useDeleteGroup, useReorderGroups, useUpdateGroup } from '@/features/booking/hooks/use-spa'
import { problemCode } from '@/features/booking/lib/problem'
import { ServiceGroupFormDialog, type GroupDialogTarget } from './ServiceGroupFormDialog'

/**
 * Tab Nhóm dịch vụ (UC-01 1a): thêm, đổi tên, sắp xếp bằng nút lên/xuống, bật/tắt hiển thị;
 * xóa khi nhóm không còn dịch vụ (409 DaPhatSinh).
 */
export function ServiceGroupsTab({
  groups,
  isLoading,
  error,
  onRetry,
}: {
  groups: ServiceGroupDto[] | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { can } = usePermissions()
  const canCreate = can(permissions.services.create)
  const canUpdate = can(permissions.services.update)
  const canDelete = can(permissions.services.delete)
  const updateGroup = useUpdateGroup()
  const reorder = useReorderGroups()
  const remove = useDeleteGroup()
  const [dialog, setDialog] = useState<GroupDialogTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceGroupDto | null>(null)
  // Thứ tự vừa đổi, hiện ngay trong lúc chờ máy chủ; bỏ qua khi dữ liệu máy chủ đã khác lúc đổi
  const [localOrder, setLocalOrder] = useState<{ ids: string[]; base: string } | null>(null)

  const serverKey = (groups ?? []).map((g) => g.id).join(',')
  const rows = useMemo(() => {
    const list = groups ?? []
    if (!localOrder || localOrder.base !== serverKey) return list
    const byId = new Map(list.map((g) => [g.id, g]))
    return localOrder.ids.map((id) => byId.get(id)).filter((g): g is ServiceGroupDto => !!g)
  }, [groups, localOrder, serverKey])

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    const ids = rows.map((g) => g.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    setLocalOrder({ ids, base: serverKey })
    reorder.mutate(ids, {
      onError: (err) => {
        setLocalOrder(null)
        toast.error(`Không đổi được thứ tự: ${getErrorMessage(err)}`)
      },
    })
  }

  const toggleVisible = (g: ServiceGroupDto, isVisible: boolean) => {
    updateGroup.mutate(
      { id: g.id, input: { name: g.name, isVisible } },
      {
        onSuccess: () =>
          isVisible
            ? toast.success(`Đã hiện nhóm ${g.name}`)
            : toast.success(`Đã ẩn nhóm ${g.name}`, {
                description: 'Dịch vụ trong nhóm không còn ở hộp tạo lịch và trang đặt online.',
              }),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await remove.mutateAsync(target.id)
      toast.success(`Đã xóa nhóm ${target.name}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
      // Nhóm còn dịch vụ: đóng hộp thoại, thông báo đã đủ hướng dẫn
      if (problemCode(err) === 'DaPhatSinh') return
      throw err
    }
  }

  const togglingId = updateGroup.isPending ? updateGroup.variables?.id : null
  const showActions = canUpdate || canDelete

  return (
    <>
      <div className="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 sm:p-4">
          <p className="text-muted-foreground text-sm">
            Thứ tự nhóm là thứ tự hiện trên hộp tạo lịch và trang đặt online. Nhóm ẩn thì mọi dịch
            vụ trong nhóm cũng ẩn.
          </p>
          {canCreate && (
            <Button onClick={() => setDialog({ group: null })}>
              <Plus aria-hidden="true" />
              Thêm nhóm
            </Button>
          )}
        </div>

        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : (
          <div className="overflow-x-auto" aria-busy={isLoading || reorder.isPending}>
            <Table style={{ minWidth: 640 }}>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <Head className="w-28">Thứ tự</Head>
                  <Head>Nhóm dịch vụ</Head>
                  <Head className="w-32 text-right">Số dịch vụ</Head>
                  <Head className="w-40">Hiển thị</Head>
                  <Head className="w-14">
                    <span className="sr-only">Thao tác</span>
                  </Head>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                        {Array.from({ length: 5 }, (_, j) => (
                          <TableCell key={j} className="h-14 px-4">
                            <Skeleton className={cn('h-4', j === 1 ? 'w-40' : 'w-14')} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : rows.map((g, index) => (
                      <TableRow
                        key={g.id}
                        className="hover:bg-muted/40 transition-colors duration-150"
                      >
                        <TableCell className="px-4 py-2">
                          {canUpdate ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Đưa nhóm ${g.name} lên trên`}
                                disabled={index === 0 || reorder.isPending}
                                onClick={() => move(index, -1)}
                              >
                                <ArrowUp />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Đưa nhóm ${g.name} xuống dưới`}
                                disabled={index === rows.length - 1 || reorder.isPending}
                                onClick={() => move(index, 1)}
                              >
                                <ArrowDown />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground tabular-nums">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2 font-medium">{g.name}</TableCell>
                        <TableCell className="px-4 py-2 text-right tabular-nums">
                          {g.serviceCount}
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          {canUpdate ? (
                            <label className="inline-flex cursor-pointer items-center gap-2">
                              <Switch
                                checked={g.isVisible}
                                disabled={togglingId === g.id}
                                onCheckedChange={(v) => toggleVisible(g, v)}
                                aria-label={`Hiển thị nhóm ${g.name}`}
                              />
                              <span
                                className={cn('text-sm', !g.isVisible && 'text-muted-foreground')}
                              >
                                {g.isVisible ? 'Đang hiện' : 'Đang ẩn'}
                              </span>
                            </label>
                          ) : g.isVisible ? (
                            <StatusBadge tone="success">Đang hiện</StatusBadge>
                          ) : (
                            <StatusBadge tone="neutral">Đang ẩn</StatusBadge>
                          )}
                        </TableCell>
                        <TableCell className="w-14 px-4 py-2 text-right">
                          {showActions && (
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Thao tác với nhóm ${g.name}`}
                                >
                                  <MoreHorizontal />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-60">
                                <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">
                                  {g.name}
                                </DropdownMenuLabel>
                                {canUpdate && (
                                  <DropdownMenuItem
                                    className="h-9"
                                    onSelect={() => setDialog({ group: g })}
                                  >
                                    <Pencil aria-hidden="true" /> Đổi tên nhóm
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      className="h-9"
                                      disabled={g.serviceCount > 0}
                                      onSelect={() => setDeleteTarget(g)}
                                    >
                                      <Trash2 aria-hidden="true" /> Xóa nhóm
                                    </DropdownMenuItem>
                                    {g.serviceCount > 0 && (
                                      <p className="bg-muted/60 text-muted-foreground mt-1 rounded-sm px-2 py-1.5 text-xs leading-snug">
                                        Nhóm còn {g.serviceCount} dịch vụ, chuyển hoặc xóa các dịch
                                        vụ trước.
                                      </p>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
            {!isLoading && rows.length === 0 && (
              <EmptyState
                icon={FolderTree}
                title="Chưa có nhóm dịch vụ"
                description="Tạo nhóm trước (vd Chăm sóc da, Nail, Tóc) rồi thêm dịch vụ vào nhóm."
                action={
                  canCreate && (
                    <Button onClick={() => setDialog({ group: null })}>
                      <Plus aria-hidden="true" />
                      Thêm nhóm
                    </Button>
                  )
                }
              />
            )}
          </div>
        )}
      </div>

      <ServiceGroupFormDialog target={dialog} onOpenChange={(o) => !o && setDialog(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title={`Xóa nhóm ${deleteTarget?.name ?? ''}?`}
        description="Nhóm không còn dịch vụ nào và sẽ bị xóa khỏi danh mục."
        confirmText="Xóa nhóm"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function Head({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TableHead
      className={cn(
        'text-muted-foreground h-11 px-4 text-xs font-semibold tracking-wide uppercase',
        className
      )}
    >
      {children}
    </TableHead>
  )
}
