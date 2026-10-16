'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Package, PackagePlus } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatPhone } from '@/lib/format'
import type { CustomerPackageDto, CustomerPackageQuery, CustomerPackageStatus } from '@/types/spa'
import { PackageStatusBadge } from '@/features/booking/components/SpaBadges'
import { useCustomerPackages } from '@/features/booking/hooks/use-spa'
import { packageStatusLabels } from '@/features/booking/lib/labels'
import { ddmmyyyy, vnDdMmYyyy } from '@/features/booking/lib/vn-time'
import { PackageDetailSheet } from './PackageDetailSheet'
import { SellPackageDialog } from './SellPackageDialog'

type Filters = Pick<CustomerPackageQuery, 'status' | 'filter'>

/** Tab Gói của khách (UC-09): lọc Đang dùng, Sắp hết hạn (30 ngày), Còn 1 buổi, Hết hạn; bán gói; mở chi tiết. */
export function CustomerPackagesTab() {
  const { can } = usePermissions()
  const table = useTableQuery<Filters>({ pageSize: 20, status: 'DangDung' })
  const packages = useCustomerPackages(table.query)
  const [openId, setOpenId] = useState<string | null>(null)
  const [sellOpen, setSellOpen] = useState(false)

  const quick = table.state.filter ?? (table.state.status ? `status:${table.state.status}` : 'all')
  const setQuick = (v: string) => {
    if (v === 'expiringSoon' || v === 'lastSession') {
      table.setFilter('status', undefined)
      table.setFilter('filter', v)
    } else {
      table.setFilter('filter', undefined)
      table.setFilter('status', v === 'all' ? undefined : (v.slice(7) as CustomerPackageStatus))
    }
  }

  const columns = useMemo<ColumnDef<CustomerPackageDto>[]>(
    () => [
      {
        id: 'code',
        header: 'Gói',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.packageName}</p>
            <p className="text-muted-foreground text-xs tabular-nums">{row.original.code}</p>
          </div>
        ),
      },
      {
        id: 'customer',
        header: 'Khách hàng',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p>{row.original.customerName}</p>
            <p className="text-muted-foreground text-xs tabular-nums">{formatPhone(row.original.customerPhone)}</p>
          </div>
        ),
      },
      {
        id: 'remaining',
        header: 'Còn lại',
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="w-32 space-y-1">
              <p className="text-sm tabular-nums">
                <b className={p.remaining === 1 && p.status === 'DangDung' ? 'text-warning' : undefined}>{p.remaining}</b>/{p.totalSessions} buổi
              </p>
              <Progress value={(p.usedSessions / Math.max(1, p.totalSessions)) * 100} className="h-1.5" aria-hidden="true" />
            </div>
          )
        },
      },
      {
        id: 'expiryDate',
        header: 'Hạn dùng',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="tabular-nums">{ddmmyyyy(row.original.expiryDate)}</span>
            {row.original.expiringSoon && (
              <StatusBadge tone="warning" dot={false} className="h-5">
                Sắp hết hạn
              </StatusBadge>
            )}
          </div>
        ),
      },
      { id: 'status', header: 'Trạng thái', cell: ({ row }) => <PackageStatusBadge status={row.original.status} /> },
      {
        id: 'purchasedAt',
        header: 'Ngày mua',
        cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{vnDdMmYyyy(row.original.purchasedAt)}</span>,
      },
      { id: 'consultantName', header: 'Người tư vấn', cell: ({ row }) => row.original.consultantName },
    ],
    []
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={packages.data?.items}
        getRowId={(p) => p.id}
        isLoading={packages.isLoading}
        isFetching={packages.isFetching}
        error={packages.error}
        onRetry={() => void packages.refetch()}
        onRowClick={(p) => setOpenId(p.id)}
        minWidth={900}
        pagination={
          packages.data && {
            page: packages.data.page,
            pageSize: packages.data.pageSize,
            totalCount: packages.data.totalCount,
            totalPages: packages.data.totalPages,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }
        }
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput value={table.state.search} onSearch={table.setSearch} placeholder="Tìm mã gói, tên khách, SĐT" className="sm:max-w-sm" />
            <Select value={quick} onValueChange={setQuick}>
              <SelectTrigger className="sm:w-48" aria-label="Lọc gói">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả gói</SelectItem>
                {(Object.keys(packageStatusLabels) as CustomerPackageStatus[]).map((s) => (
                  <SelectItem key={s} value={`status:${s}`}>
                    {packageStatusLabels[s].label}
                  </SelectItem>
                ))}
                <SelectItem value="expiringSoon">Sắp hết hạn (30 ngày)</SelectItem>
                <SelectItem value="lastSession">Còn 1 buổi</SelectItem>
              </SelectContent>
            </Select>
            {can(permissions.customerPackages.sell) && (
              <Button className="sm:ml-auto" onClick={() => setSellOpen(true)}>
                <PackagePlus aria-hidden="true" />
                Bán gói
              </Button>
            )}
          </div>
        }
        emptyState={<EmptyState icon={Package} title="Không có gói phù hợp" description="Đổi bộ lọc hoặc bán gói mới cho khách." />}
      />
      <PackageDetailSheet packageId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
      <SellPackageDialog open={sellOpen} onOpenChange={setSellOpen} />
    </>
  )
}
