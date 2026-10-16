'use client'

import { Fragment, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
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
import { formatVnd } from '@/lib/format'
import { matchesSearch } from '@/lib/normalize'
import { cn } from '@/lib/utils'
import type { ServiceDto, ServiceGroupDto } from '@/types/spa'
import {
  useDeleteService,
  useServices,
  useSetServiceVisibility,
} from '@/features/booking/hooks/use-spa'
import { commissionText } from '@/features/booking/lib/labels'
import { problemCode } from '@/features/booking/lib/problem'
import { floor1000 } from '@/features/booking/lib/rules'
import { ServiceFormDialog, type ServiceDialogTarget } from './ServiceFormDialog'

const ALL = 'all'

/** Số cột của bảng (dùng cho dòng tiêu đề nhóm) */
const COLUMN_COUNT = 9

/**
 * Tab Dịch vụ (UC-01 luồng chính, 1c, 1d, E3, E4): danh sách theo nhóm gồm mã, tên, thời lượng, giá, hoa hồng,
 * số KTV làm được, trạng thái cho đặt online và hiển thị. Tìm theo mã/tên không dấu, lọc theo nhóm.
 */
export function ServicesTab({ groups }: { groups: ServiceGroupDto[] | undefined }) {
  const { can } = usePermissions()
  const canCreate = can(permissions.services.create)
  const canUpdate = can(permissions.services.update)
  const canDelete = can(permissions.services.delete)
  const services = useServices()
  const setVisibility = useSetServiceVisibility()
  const remove = useDeleteService()

  const [search, setSearch] = useState('')
  const [searchKey, setSearchKey] = useState(0)
  const [groupFilter, setGroupFilter] = useState(ALL)
  const [dialog, setDialog] = useState<ServiceDialogTarget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceDto | null>(null)

  const filtered = useMemo(
    () =>
      (services.data ?? []).filter(
        (s) =>
          (groupFilter === ALL || s.groupId === groupFilter) &&
          matchesSearch(`${s.code} ${s.name}`, search)
      ),
    [services.data, groupFilter, search]
  )

  // Gom theo nhóm, giữ thứ tự nhóm (SortOrder); dịch vụ của nhóm lạ (nếu có) xếp cuối
  const sections = useMemo(() => {
    const byGroup = new Map<string, ServiceDto[]>()
    for (const s of filtered) byGroup.set(s.groupId, [...(byGroup.get(s.groupId) ?? []), s])
    const ordered: { id: string; name: string; isVisible: boolean; items: ServiceDto[] }[] = []
    for (const g of groups ?? []) {
      const items = byGroup.get(g.id)
      if (items?.length) ordered.push({ id: g.id, name: g.name, isVisible: g.isVisible, items })
      byGroup.delete(g.id)
    }
    for (const [id, items] of byGroup)
      ordered.push({ id, name: items[0].groupName || 'Chưa có nhóm', isVisible: true, items })
    return ordered
  }, [filtered, groups])

  const total = services.data?.length ?? 0
  const hiddenCount = services.data?.filter((s) => !s.isVisible).length ?? 0
  const warningCount = services.data?.filter((s) => !!s.onlineWarning).length ?? 0
  const filtering = !!search || groupFilter !== ALL
  const showActions = canUpdate || canDelete

  const clearFilters = () => {
    setSearch('')
    setSearchKey((k) => k + 1)
    setGroupFilter(ALL)
  }

  const toggleVisibility = (s: ServiceDto) => {
    setVisibility.mutate(
      { id: s.id, isVisible: !s.isVisible },
      {
        onSuccess: (saved) =>
          saved.isVisible
            ? toast.success(
                `Đã hiện dịch vụ ${saved.name}`,
                saved.onlineWarning ? { description: saved.onlineWarning } : undefined
              )
            : toast.success(`Đã ẩn dịch vụ ${saved.name}`, {
                description:
                  'Dịch vụ không còn ở hộp tạo lịch, trang đặt online; lịch hẹn đã tạo giữ nguyên.',
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
      toast.success(`Đã xóa dịch vụ ${target.name}`)
    } catch (err) {
      // BR-27: dịch vụ đã phát sinh lịch hẹn, hóa đơn thì không xóa được, gợi ý Ẩn (UC-01 E3)
      if (problemCode(err) === 'DaPhatSinh') {
        toast.error(
          getErrorMessage(err),
          target.isVisible && canUpdate
            ? { action: { label: 'Ẩn dịch vụ', onClick: () => toggleVisibility(target) } }
            : { description: 'Dịch vụ đang ẩn nên không còn ở hộp tạo lịch và trang đặt online.' }
        )
        return
      }
      toast.error(getErrorMessage(err))
      throw err
    }
  }

  return (
    <>
      <div className="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-xs">
        <div className="space-y-3 border-b p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              key={searchKey}
              onSearch={setSearch}
              placeholder="Tìm theo mã, tên dịch vụ…"
            />
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-56" aria-label="Lọc theo nhóm dịch vụ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tất cả nhóm</SelectItem>
                {(groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canCreate && (
              <Button
                className="sm:ml-auto"
                onClick={() =>
                  setDialog({
                    service: null,
                    groupId: groupFilter === ALL ? undefined : groupFilter,
                  })
                }
              >
                <Plus aria-hidden="true" />
                Thêm dịch vụ
              </Button>
            )}
          </div>
          {services.data && (
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>
                <b className="text-foreground tabular-nums">{total}</b> dịch vụ
                {hiddenCount > 0 && <>, {hiddenCount} đang ẩn</>}
              </span>
              {warningCount > 0 && (
                <span className="text-warning inline-flex items-center gap-1">
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  {warningCount} dịch vụ bật đặt online nhưng chưa hiện trên trang đặt lịch
                </span>
              )}
            </p>
          )}
        </div>

        {services.error ? (
          <ErrorState error={services.error} onRetry={() => void services.refetch()} />
        ) : (
          <div
            className={cn(
              'overflow-x-auto transition-opacity duration-200',
              services.isFetching && !services.isLoading && 'opacity-60'
            )}
            aria-busy={services.isLoading || services.isFetching}
          >
            <Table style={{ minWidth: 1040 }}>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <Head className="w-24">Mã</Head>
                  <Head>Dịch vụ</Head>
                  <Head className="w-32">Thời lượng</Head>
                  <Head className="w-32 text-right">Giá</Head>
                  <Head className="w-36">Hoa hồng</Head>
                  <Head className="w-20 text-center">KTV</Head>
                  <Head className="w-40">Đặt online</Head>
                  <Head className="w-28">Hiển thị</Head>
                  <Head className="w-14">
                    <span className="sr-only">Thao tác</span>
                  </Head>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.isLoading
                  ? Array.from({ length: 6 }, (_, i) => (
                      <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                        {Array.from({ length: COLUMN_COUNT }, (_, j) => (
                          <TableCell key={j} className="h-14 px-4">
                            <Skeleton className={cn('h-4', j === 1 ? 'w-48' : 'w-16')} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : sections.map((section) => (
                      <Fragment key={section.id}>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={COLUMN_COUNT} className="px-4 py-2">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{section.name}</span>
                              <span className="text-muted-foreground text-xs tabular-nums">
                                {section.items.length} dịch vụ
                              </span>
                              {!section.isVisible && (
                                <StatusBadge tone="neutral">Nhóm đang ẩn</StatusBadge>
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                        {section.items.map((s) => (
                          <ServiceRow
                            key={s.id}
                            service={s}
                            canUpdate={canUpdate}
                            canDelete={canDelete}
                            showActions={showActions}
                            onEdit={() => setDialog({ service: s })}
                            onToggleVisibility={() => toggleVisibility(s)}
                            onDelete={() => setDeleteTarget(s)}
                          />
                        ))}
                      </Fragment>
                    ))}
              </TableBody>
            </Table>
            {!services.isLoading &&
              sections.length === 0 &&
              (filtering ? (
                <EmptyState
                  icon={SearchX}
                  title="Không tìm thấy dịch vụ"
                  description="Thử từ khóa khác hoặc chọn tất cả nhóm."
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      Xóa bộ lọc
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="Chưa có dịch vụ"
                  description="Thêm dịch vụ để lễ tân tạo lịch và khách đặt online."
                  action={
                    canCreate && (
                      <Button onClick={() => setDialog({ service: null })}>
                        <Plus aria-hidden="true" />
                        Thêm dịch vụ
                      </Button>
                    )
                  }
                />
              ))}
          </div>
        )}
      </div>

      <ServiceFormDialog
        target={dialog}
        groups={groups ?? []}
        onOpenChange={(o) => !o && setDialog(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title={`Xóa dịch vụ ${deleteTarget?.name ?? ''}?`}
        description="Chỉ xóa được dịch vụ chưa có lịch hẹn, hóa đơn hay gói mẫu. Dịch vụ đã dùng thì chọn Ẩn để giữ lịch sử."
        confirmText="Xóa dịch vụ"
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

function ServiceRow({
  service: s,
  canUpdate,
  canDelete,
  showActions,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  service: ServiceDto
  canUpdate: boolean
  canDelete: boolean
  showActions: boolean
  onEdit: () => void
  onToggleVisibility: () => void
  onDelete: () => void
}) {
  const estimate =
    s.commissionType === 'PhanTram' ? floor1000((s.price * s.commissionValue) / 100) : null
  return (
    <TableRow className="hover:bg-muted/40 transition-colors duration-150">
      <TableCell className="px-4 py-2 font-mono text-xs">{s.code}</TableCell>
      <TableCell className="px-4 py-2">
        <div className="max-w-80 min-w-56">
          {canUpdate ? (
            <button
              type="button"
              onClick={onEdit}
              className="focus-visible:ring-ring/50 cursor-pointer rounded-sm text-left font-medium whitespace-normal outline-none hover:underline focus-visible:ring-3"
            >
              {s.name}
            </button>
          ) : (
            <p className="font-medium whitespace-normal">{s.name}</p>
          )}
          {s.description && (
            <p className="text-muted-foreground truncate text-xs" title={s.description}>
              {s.description}
            </p>
          )}
          {s.onlineWarning && (
            <p className="text-warning mt-0.5 flex items-start gap-1 text-xs whitespace-normal">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {s.onlineWarning}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 py-2 tabular-nums">
        {s.durationMinutes} phút
        {s.cleanupMinutes > 0 && (
          <span className="text-muted-foreground block text-xs">+{s.cleanupMinutes} phút dọn</span>
        )}
      </TableCell>
      <TableCell className="px-4 py-2 text-right font-medium tabular-nums">
        {formatVnd(s.price)}
      </TableCell>
      <TableCell className="px-4 py-2 tabular-nums">
        {commissionText(s.commissionType, s.commissionValue)}
        {estimate !== null && (
          <span className="text-muted-foreground block text-xs">≈ {formatVnd(estimate)}/lượt</span>
        )}
      </TableCell>
      <TableCell
        className={cn(
          'px-4 py-2 text-center tabular-nums',
          s.technicianCount === 0 && 'text-warning font-medium'
        )}
      >
        {s.technicianCount}
      </TableCell>
      <TableCell className="px-4 py-2">
        {!s.allowOnline ? (
          <StatusBadge tone="neutral">Chỉ tại quầy</StatusBadge>
        ) : s.onlineWarning ? (
          <StatusBadge
            tone="warning"
            icon={<AlertTriangle className="size-3" aria-hidden="true" />}
          >
            Chưa hiện online
          </StatusBadge>
        ) : (
          <StatusBadge tone="success">Cho đặt online</StatusBadge>
        )}
      </TableCell>
      <TableCell className="px-4 py-2">
        {s.isVisible ? (
          <StatusBadge tone="success">Đang hiện</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Đang ẩn</StatusBadge>
        )}
      </TableCell>
      <TableCell className="w-14 px-4 py-2 text-right">
        {showActions && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Thao tác với dịch vụ ${s.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">
                {s.name}
              </DropdownMenuLabel>
              {canUpdate && (
                <>
                  <DropdownMenuItem className="h-9" onSelect={onEdit}>
                    <Pencil aria-hidden="true" /> Sửa dịch vụ
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-9" onSelect={onToggleVisibility}>
                    {s.isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    {s.isVisible ? 'Ẩn dịch vụ' : 'Hiện dịch vụ'}
                  </DropdownMenuItem>
                </>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" className="h-9" onSelect={onDelete}>
                    <Trash2 aria-hidden="true" /> Xóa dịch vụ
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )
}
