'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ban, Loader2, MoreHorizontal, Package, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { PackageTemplateDto, SavePackageTemplateInput } from '@/types/spa'
import { MoneyInput } from '@/features/booking/components/MoneyInput'
import {
  useCreateTemplate,
  useDeleteTemplate,
  usePackageTemplates,
  useServices,
  useSetTemplateActive,
  useUpdateTemplate,
} from '@/features/booking/hooks/use-spa'
import { problemCode } from '@/features/booking/lib/problem'
import { bookingRules, sessionValueOf } from '@/features/booking/lib/rules'
import { validateTemplate } from '@/features/booking/lib/validation'
import { catalogService } from '@/features/booking/services/catalog.service'

/** Tab Gói mẫu (UC-01 1b): giá lẻ tương đương, tiết kiệm, giá trị một buổi (BR-22); ngừng bán thay vì xóa khi đã bán (BR-27). */
export function TemplatesTab() {
  const { can } = usePermissions()
  const templates = usePackageTemplates()
  const setActive = useSetTemplateActive()
  const remove = useDeleteTemplate()
  const [form, setForm] = useState<PackageTemplateDto | 'new' | null>(null)
  const [deleting, setDeleting] = useState<PackageTemplateDto | null>(null)
  const canCreate = can(permissions.packages.create)
  const canUpdate = can(permissions.packages.update)
  const canDelete = can(permissions.packages.delete)

  const toggle = (t: PackageTemplateDto) =>
    setActive.mutate(
      { id: t.id, isActive: !t.isActive },
      {
        onSuccess: (r) => toast.success(r.isActive ? `Đã mở bán ${r.name}` : `Đã ngừng bán ${r.name}, gói khách đã mua vẫn dùng bình thường`),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setForm('new')}>
            <Plus aria-hidden="true" />
            Thêm gói
          </Button>
        </div>
      )}
      <div className="bg-card overflow-x-auto rounded-xl border shadow-xs">
        {templates.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : templates.error ? (
          <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
        ) : !templates.data?.length ? (
          <EmptyState icon={Package} title="Chưa có gói mẫu" description="Thêm gói để bán cho khách theo liệu trình." />
        ) : (
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead>Gói</TableHead>
                <TableHead>Dịch vụ</TableHead>
                <TableHead className="text-right">Số buổi</TableHead>
                <TableHead className="text-right">Giá gói</TableHead>
                <TableHead className="text-right">Giá lẻ tương đương</TableHead>
                <TableHead className="text-right">Tiết kiệm</TableHead>
                <TableHead className="text-right">Một buổi</TableHead>
                <TableHead>Hạn, khoảng cách</TableHead>
                <TableHead className="text-right">Hoa hồng</TableHead>
                <TableHead className="text-right">Đã bán</TableHead>
                <TableHead>Trạng thái</TableHead>
                {(canUpdate || canDelete) && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.data.map((t) => (
                <TableRow key={t.id} className={t.isActive ? undefined : 'text-muted-foreground'}>
                  <TableCell>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">{t.code}</p>
                  </TableCell>
                  <TableCell>{t.serviceName}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.sessions}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatVnd(t.price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(t.retailEquivalent)}</TableCell>
                  <TableCell className="text-success text-right tabular-nums">
                    {formatVnd(t.savingAmount)} <span className="text-xs">({t.savingPercent}%)</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatVnd(t.sessionValue)}</TableCell>
                  <TableCell className="text-sm">
                    {t.validityMonths} tháng{t.minIntervalDays ? `, cách ${t.minIntervalDays} ngày` : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.commissionRate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{t.soldCount}</TableCell>
                  <TableCell>
                    {t.isActive ? <StatusBadge tone="success">Đang bán</StatusBadge> : <StatusBadge tone="neutral">Ngừng bán</StatusBadge>}
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Thao tác với ${t.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canUpdate && (
                            <DropdownMenuItem onSelect={() => setForm(t)}>
                              <Pencil aria-hidden="true" />
                              Sửa
                            </DropdownMenuItem>
                          )}
                          {canUpdate && (
                            <DropdownMenuItem onSelect={() => toggle(t)}>
                              {t.isActive ? <Ban aria-hidden="true" /> : <Play aria-hidden="true" />}
                              {t.isActive ? 'Ngừng bán' : 'Mở bán lại'}
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(t)}>
                              <Trash2 aria-hidden="true" />
                              Xóa
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TemplateFormDialog target={form} onOpenChange={(o) => !o && setForm(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Xóa gói mẫu ${deleting?.name ?? ''}?`}
        description="Chỉ xóa được gói chưa bán lần nào. Gói đã bán hãy dùng Ngừng bán."
        confirmText="Xóa"
        variant="destructive"
        icon={Trash2}
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success(`Đã xóa gói ${deleting.name}`)
          } catch (err) {
            toast.error(problemCode(err) === 'DaPhatSinh' ? `${getErrorMessage(err)} Dùng "Ngừng bán" thay cho xóa.` : getErrorMessage(err))
            throw err
          }
        }}
      />
    </div>
  )
}

function TemplateFormDialog({ target, onOpenChange }: { target: PackageTemplateDto | 'new' | null; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {target !== null && (
          <TemplateForm key={target === 'new' ? 'new' : target.id} template={target === 'new' ? null : target} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TemplateForm({ template, onClose }: { template: PackageTemplateDto | null; onClose: () => void }) {
  const services = useServices()
  const nextCode = useQuery({ queryKey: ['spa', 'package-template-next-code'], queryFn: catalogService.nextTemplateCode, enabled: !template, staleTime: 0 })
  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const pending = create.isPending || update.isPending
  const [form, setForm] = useState<SavePackageTemplateInput>(() =>
    template
      ? {
          code: template.code,
          name: template.name,
          serviceId: template.serviceId,
          sessions: template.sessions,
          price: template.price,
          validityMonths: template.validityMonths,
          minIntervalDays: template.minIntervalDays,
          commissionRate: template.commissionRate,
          isActive: template.isActive,
        }
      : {
          code: '',
          name: '',
          serviceId: '',
          sessions: 10,
          price: 0,
          validityMonths: 6,
          minIntervalDays: 0,
          commissionRate: bookingRules.defaultPackageCommissionRate,
          isActive: true,
        }
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<SavePackageTemplateInput>) => setForm((f) => ({ ...f, ...patch }))
  const code = form.code || (!template ? (nextCode.data?.code ?? '') : '')
  const service = services.data?.find((s) => s.id === form.serviceId)
  const retail = (service?.price ?? 0) * form.sessions
  const saving = retail - form.price
  const savingPercent = retail > 0 ? Math.round((saving * 1000) / retail) / 10 : 0
  const num = (v: string, max = 3) => Number(v.replace(/\D/g, '').slice(0, max)) || 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input = { ...form, code: code.trim().toUpperCase(), name: form.name.trim() }
    const local = validateTemplate(input)
    setErrors(local)
    if (Object.keys(local).length) return
    const handlers = {
      onSuccess: (t: PackageTemplateDto) => {
        toast.success(template ? `Đã lưu gói ${t.name}` : `Đã thêm gói ${t.name}`)
        onClose()
      },
      onError: (err: unknown) => {
        const fields = getFieldErrors(err)
        setErrors(fields)
        if (!Object.keys(fields).length) toast.error(getErrorMessage(err))
      },
    }
    if (template) update.mutate({ id: template.id, input }, handlers)
    else create.mutate(input, handlers)
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{template ? `Sửa gói ${template.code}` : 'Thêm gói liệu trình mẫu'}</DialogTitle>
        <DialogDescription>Đổi giá gói không ảnh hưởng gói khách đã mua.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Mã gói" required error={errors.code}>
          <Input value={code} maxLength={20} onChange={(e) => set({ code: e.target.value.toUpperCase() })} className="uppercase" />
        </FormField>
        <FormField label="Tên gói" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} maxLength={150} onChange={(e) => set({ name: e.target.value })} placeholder="Vd Gói 10 buổi chăm sóc da" />
        </FormField>
        <FormField label="Dịch vụ áp dụng" required error={errors.serviceId} className="sm:col-span-2">
          <Select value={form.serviceId} onValueChange={(v) => set({ serviceId: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn dịch vụ" />
            </SelectTrigger>
            <SelectContent>
              {(services.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {formatVnd(s.price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Số buổi" required error={errors.sessions}>
          <Input inputMode="numeric" value={form.sessions || ''} onChange={(e) => set({ sessions: num(e.target.value, 2) })} className="tabular-nums" />
        </FormField>
        <FormField label="Giá gói" required error={errors.price}>
          <MoneyInput value={form.price || null} onValueChange={(v) => set({ price: v ?? 0 })} />
        </FormField>
        <FormField label="Hạn dùng (tháng)" required error={errors.validityMonths}>
          <Input
            inputMode="numeric"
            value={form.validityMonths || ''}
            onChange={(e) => set({ validityMonths: num(e.target.value, 2) })}
            className="tabular-nums"
          />
        </FormField>
        <FormField label="Cách buổi tối thiểu (ngày)" error={errors.minIntervalDays} hint="0 là không yêu cầu">
          <Input
            inputMode="numeric"
            value={String(form.minIntervalDays)}
            onChange={(e) => set({ minIntervalDays: num(e.target.value, 2) })}
            className="tabular-nums"
          />
        </FormField>
        <FormField label="Hoa hồng bán gói (%)" error={errors.commissionRate}>
          <Input
            inputMode="decimal"
            value={String(form.commissionRate)}
            onChange={(e) => set({ commissionRate: Number(e.target.value.replace(/[^\d.]/g, '').slice(0, 4)) || 0 })}
            className="tabular-nums"
          />
        </FormField>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <Switch checked={form.isActive} onCheckedChange={(c) => set({ isActive: c })} />
          Đang bán
        </label>
      </div>
      {service && form.price > 0 && form.sessions > 0 && (
        <dl className="bg-muted/40 grid grid-cols-3 gap-3 rounded-lg p-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Giá lẻ tương đương</dt>
            <dd className="font-medium tabular-nums">{formatVnd(retail)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Khách tiết kiệm</dt>
            <dd className={`font-medium tabular-nums ${saving >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatVnd(saving)} ({savingPercent}%)
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Giá trị một buổi</dt>
            <dd className="font-medium tabular-nums">{formatVnd(sessionValueOf(form.price, form.sessions))}</dd>
          </div>
        </dl>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Hủy
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Lưu
        </Button>
      </DialogFooter>
    </form>
  )
}
