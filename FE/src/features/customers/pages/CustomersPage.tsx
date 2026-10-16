'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Users } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatPhone, formatVnd } from '@/lib/format'
import type { CustomerDto } from '@/types/spa'
import { FlaggedBadge } from '@/features/booking/components/SpaBadges'
import { useCustomers } from '@/features/booking/hooks/use-spa'
import { vnDdMmYyyy } from '@/features/booking/lib/vn-time'
import { CustomerDrawer } from '../components/CustomerDrawer'
import { CustomerFormDialog } from '../components/CustomerFormDialog'

type Filters = { flagged: boolean; hasActivePackage: boolean }

/** Khách hàng (SCR-14, UC-13): tìm theo SĐT/tên, lọc "Hay bỏ hẹn", có gói đang dùng; mở ngăn kéo chi tiết. */
export function CustomersPage() {
  const { can } = usePermissions()
  const table = useTableQuery<Filters>({ pageSize: 20 })
  const customers = useCustomers(table.query)
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<CustomerDto | 'new' | null>(null)
  const [searchKey, setSearchKey] = useState(0)
  const hasFilters = !!table.state.search || table.state.flagged !== undefined || table.state.hasActivePackage !== undefined

  const columns = useMemo<ColumnDef<CustomerDto>[]>(
    () => [
      {
        id: 'fullName',
        header: 'Khách hàng',
        enableSorting: true,
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{c.fullName}</span>
                {c.isFlagged && <FlaggedBadge />}
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {c.code} · {formatPhone(c.phone)}
              </span>
            </div>
          )
        },
      },
      {
        id: 'note',
        header: 'Ghi chú',
        cell: ({ row }) => <span className="text-muted-foreground line-clamp-2 max-w-64 text-sm">{row.original.note ?? ''}</span>,
      },
      {
        id: 'visitCount',
        header: () => <span className="block text-right">Lượt làm</span>,
        cell: ({ row }) => <span className="block text-right tabular-nums">{row.original.visitCount}</span>,
      },
      {
        id: 'totalSpent',
        header: () => <span className="block text-right">Tổng chi tiêu</span>,
        cell: ({ row }) => <span className="block text-right font-medium tabular-nums">{formatVnd(row.original.totalSpent)}</span>,
      },
      {
        id: 'lastVisitAt',
        header: 'Lần gần nhất',
        cell: ({ row }) => <span className="tabular-nums">{row.original.lastVisitAt ? vnDdMmYyyy(row.original.lastVisitAt) : '—'}</span>,
      },
      {
        id: 'activePackageCount',
        header: () => <span className="block text-right">Gói đang dùng</span>,
        cell: ({ row }) => <span className="block text-right tabular-nums">{row.original.activePackageCount || '—'}</span>,
      },
      {
        id: 'noShowCount90',
        header: () => <span className="block text-right">Không đến (90 ngày)</span>,
        cell: ({ row }) => (
          <span className={`block text-right tabular-nums ${row.original.noShowCount90 >= 3 ? 'text-warning font-semibold' : ''}`}>
            {row.original.noShowCount90}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Ngày tạo',
        enableSorting: true,
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{vnDdMmYyyy(row.original.createdAt)}</span>,
      },
    ],
    []
  )

  const boolValue = (v: boolean | undefined) => (v === undefined ? 'all' : v ? 'yes' : 'no')
  const toBool = (v: string) => (v === 'all' ? undefined : v === 'yes')

  return (
    <PermissionGuard permission={permissions.customers.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Khách hàng"
          icon={Users}
          description="Hồ sơ khách, ghi chú da và dị ứng, lịch sử lịch hẹn, gói, hóa đơn."
          actions={
            can(permissions.customers.create) && (
              <Button onClick={() => setForm('new')}>
                <Plus aria-hidden="true" />
                Thêm khách
              </Button>
            )
          }
        />
        <DataTable
          columns={columns}
          data={customers.data?.items}
          getRowId={(c) => c.id}
          isLoading={customers.isLoading}
          isFetching={customers.isFetching}
          error={customers.error}
          onRetry={() => void customers.refetch()}
          onRowClick={(c) => setOpenId(c.id)}
          minWidth={980}
          sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
          pagination={
            customers.data && {
              page: customers.data.page,
              pageSize: customers.data.pageSize,
              totalCount: customers.data.totalCount,
              totalPages: customers.data.totalPages,
              onPageChange: table.setPage,
              onPageSizeChange: table.setPageSize,
            }
          }
          toolbar={
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchInput
                key={searchKey}
                value={table.state.search}
                onSearch={table.setSearch}
                placeholder="Tìm số điện thoại, tên, mã khách"
                className="sm:max-w-sm"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select value={boolValue(table.state.flagged)} onValueChange={(v) => table.setFilter('flagged', toBool(v))}>
                  <SelectTrigger className="sm:w-48" aria-label="Lọc nhãn Hay bỏ hẹn">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Nhãn: tất cả</SelectItem>
                    <SelectItem value="yes">Hay bỏ hẹn</SelectItem>
                    <SelectItem value="no">Không bị gắn nhãn</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={boolValue(table.state.hasActivePackage)}
                  onValueChange={(v) => table.setFilter('hasActivePackage', toBool(v))}
                >
                  <SelectTrigger className="sm:w-48" aria-label="Lọc khách có gói">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Gói: tất cả</SelectItem>
                    <SelectItem value="yes">Có gói đang dùng</SelectItem>
                    <SelectItem value="no">Không có gói</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    table.resetFilters()
                    setSearchKey((k) => k + 1)
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          }
          emptyState={<EmptyState icon={Users} title="Không tìm thấy khách" description="Thử số điện thoại khác hoặc xóa bộ lọc." />}
        />
      </div>
      <CustomerDrawer customerId={openId} onOpenChange={(o) => !o && setOpenId(null)} onEdit={(c) => setForm(c)} />
      <CustomerFormDialog target={form} onOpenChange={(o) => !o && setForm(null)} onSaved={(c) => setOpenId(c.id)} />
    </PermissionGuard>
  )
}
