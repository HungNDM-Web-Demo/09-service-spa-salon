'use client'

import Link from 'next/link'
import { Pencil, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { formatPhone, formatVnd } from '@/lib/format'
import type { CustomerDto } from '@/types/spa'
import { AppointmentStatusBadge, FlaggedBadge, InvoiceStatusBadge, PackageStatusBadge } from '@/features/booking/components/SpaBadges'
import { useAppointments, useCustomer, useCustomerPackages, useInvoices } from '@/features/booking/hooks/use-spa'
import { genderText, paymentMethodLabels } from '@/features/booking/lib/labels'
import { ddmmyyyy, vnDdMmYyyy, vnHhmm, vnHhmmDate } from '@/features/booking/lib/vn-time'

type CustomerDrawerProps = {
  customerId: string | null
  onOpenChange: (open: boolean) => void
  onEdit: (c: CustomerDto) => void
}

/** Ngăn kéo chi tiết khách (SCR-14): thông tin, ghi chú da, tổng chi tiêu, tab Lịch hẹn, Gói, Hóa đơn (UC-13). */
export function CustomerDrawer({ customerId, onOpenChange, onEdit }: CustomerDrawerProps) {
  const { can } = usePermissions()
  const customer = useCustomer(customerId)
  const c = customer.data
  const enabled = !!customerId
  const appointments = useAppointments({ customerId: customerId ?? undefined, page: 1, pageSize: 50, sortBy: 'startAt', sortDir: 'desc' }, enabled)
  const packages = useCustomerPackages({ customerId: customerId ?? undefined, page: 1, pageSize: 50 }, enabled && can(permissions.customerPackages.view))
  const invoices = useInvoices({ customerId: customerId ?? undefined, page: 1, pageSize: 50 }, enabled)

  return (
    <Sheet open={!!customerId} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b p-5">
          {c ? (
            <>
              <SheetTitle className="flex flex-wrap items-center gap-2 pr-8 text-lg">
                {c.fullName}
                {c.isFlagged && <FlaggedBadge count={c.noShowCount90} />}
              </SheetTitle>
              <SheetDescription className="tabular-nums">
                {c.code} · {formatPhone(c.phone)} · {genderText(c.gender)}
                {c.birthDate ? ` · sinh ${ddmmyyyy(c.birthDate)}` : ''}
              </SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle>
                <Skeleton className="h-6 w-48" />
              </SheetTitle>
              <SheetDescription className="sr-only">Đang tải hồ sơ khách</SheetDescription>
            </>
          )}
        </SheetHeader>

        {c && (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Tổng chi tiêu" value={formatVnd(c.totalSpent)} />
              <Stat label="Lượt đã làm" value={String(c.visitCount)} />
              <Stat label="Lần gần nhất" value={c.lastVisitAt ? vnDdMmYyyy(c.lastVisitAt) : '—'} />
              <Stat label="Không đến 90 ngày" value={String(c.noShowCount90)} />
            </div>
            <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3 text-sm">
              <p className="min-w-0 flex-1">
                <span className="text-muted-foreground block text-xs">Ghi chú da, dị ứng</span>
                {c.note || <span className="text-muted-foreground">Chưa có ghi chú</span>}
              </p>
              {can(permissions.customers.update) && (
                <Button variant="outline" size="sm" onClick={() => onEdit(c)}>
                  <Pencil aria-hidden="true" />
                  Sửa
                </Button>
              )}
            </div>

            <Tabs defaultValue="appointments">
              <TabsList className="w-full">
                <TabsTrigger value="appointments">Lịch hẹn ({appointments.data?.totalCount ?? 0})</TabsTrigger>
                {can(permissions.customerPackages.view) && <TabsTrigger value="packages">Gói ({packages.data?.totalCount ?? 0})</TabsTrigger>}
                <TabsTrigger value="invoices">Hóa đơn ({invoices.data?.totalCount ?? 0})</TabsTrigger>
              </TabsList>
              <TabsContent value="appointments" className="mt-3">
                <List loading={appointments.isLoading} empty="Khách chưa có lịch hẹn.">
                  {appointments.data?.items.map((a) => (
                    <li key={a.id}>
                      <Link href={routePath.appointmentDetail(a.id)} className="hover:bg-muted/60 flex items-start gap-3 px-3 py-2.5 text-sm">
                        <div className="w-20 shrink-0 tabular-nums">
                          <p className="font-medium">{ddmmyyyy(a.date)}</p>
                          <p className="text-muted-foreground text-xs">{vnHhmm(a.startAt)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{a.services}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {a.code} · {a.staffNames}
                          </p>
                        </div>
                        <AppointmentStatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </List>
              </TabsContent>
              <TabsContent value="packages" className="mt-3">
                <List loading={packages.isLoading} empty="Khách chưa mua gói.">
                  {packages.data?.items.map((p) => (
                    <li key={p.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{p.packageName}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {p.code} · còn {p.remaining}/{p.totalSessions} buổi · hạn {ddmmyyyy(p.expiryDate)}
                        </p>
                      </div>
                      <PackageStatusBadge status={p.status} />
                    </li>
                  ))}
                </List>
              </TabsContent>
              <TabsContent value="invoices" className="mt-3">
                <List loading={invoices.isLoading} empty="Khách chưa có hóa đơn.">
                  {invoices.data?.items.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium tabular-nums">{inv.code}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {vnHhmmDate(inv.paidAt)} · {paymentMethodLabels[inv.method]}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">{formatVnd(inv.total)}</span>
                      <InvoiceStatusBadge status={inv.status} />
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`In hóa đơn ${inv.code}`}>
                        <Link href={routePath.invoicePrint(inv.id)}>
                          <Printer />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </List>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function List({ loading, empty, children }: { loading: boolean; empty: string; children: React.ReactNode }) {
  if (loading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  const items = Array.isArray(children) ? children : []
  if (items.length === 0) return <p className="text-muted-foreground rounded-lg border px-3 py-4 text-center text-sm">{empty}</p>
  return <ul className="divide-y rounded-lg border">{children}</ul>
}
