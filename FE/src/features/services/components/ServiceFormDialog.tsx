'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionType, SaveServiceInput, ServiceDto, ServiceGroupDto } from '@/types/spa'
import { MoneyInput } from '@/features/booking/components/MoneyInput'
import { useCreateService, useUpdateService } from '@/features/booking/hooks/use-spa'
import { commissionTypeLabels } from '@/features/booking/lib/labels'
import { bookingRules, floor1000 } from '@/features/booking/lib/rules'
import { validateService } from '@/features/booking/lib/validation'
import { catalogService } from '@/features/booking/services/catalog.service'

/** `service` null là thêm mới; `groupId` chọn sẵn nhóm đang lọc */
export type ServiceDialogTarget = { service: ServiceDto | null; groupId?: string }

type ServiceFormDialogProps = {
  target: ServiceDialogTarget | null
  groups: ServiceGroupDto[]
  onOpenChange: (open: boolean) => void
}

/** Thêm, sửa dịch vụ (UC-01 bước 2–6, E1, E2, E4; FR-03, BR-02, BR-23). */
export function ServiceFormDialog({ target, groups, onOpenChange }: ServiceFormDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {target && (
          <ServiceForm
            key={target.service?.id ?? 'new'}
            target={target}
            groups={groups}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const COMMISSION_TYPES: CommissionType[] = ['PhanTram', 'CoDinh']

function ServiceForm({
  target,
  groups,
  onClose,
}: {
  target: ServiceDialogTarget
  groups: ServiceGroupDto[]
  onClose: () => void
}) {
  const service = target.service
  const create = useCreateService()
  const update = useUpdateService()
  const saving = create.isPending || update.isPending

  // Mã gợi ý cho dịch vụ mới; người dùng gõ thì dùng giá trị đã gõ (null = chưa sửa)
  const nextCode = useQuery({
    queryKey: ['spa', 'service-next-code'],
    queryFn: catalogService.nextServiceCode,
    enabled: !service,
    staleTime: 0,
  })
  const [code, setCode] = useState<string | null>(service?.code ?? null)
  const [name, setName] = useState(service?.name ?? '')
  const [groupId, setGroupId] = useState(service?.groupId ?? target.groupId ?? '')
  const [duration, setDuration] = useState(service ? String(service.durationMinutes) : '60')
  const [cleanup, setCleanup] = useState(
    String(service?.cleanupMinutes ?? bookingRules.cleanupDefault)
  )
  const [price, setPrice] = useState<number | null>(service?.price ?? null)
  const [description, setDescription] = useState(service?.description ?? '')
  const [allowOnline, setAllowOnline] = useState(service?.allowOnline ?? true)
  const [commissionType, setCommissionType] = useState<CommissionType>(
    service?.commissionType ?? 'PhanTram'
  )
  const [percent, setPercent] = useState(
    service?.commissionType === 'PhanTram' ? String(service.commissionValue) : '10'
  )
  const [fixed, setFixed] = useState<number | null>(
    service?.commissionType === 'CoDinh' ? service.commissionValue : null
  )
  const [isVisible, setIsVisible] = useState(service?.isVisible ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const codeValue = code ?? nextCode.data?.code ?? ''
  const clearError = (field: string) =>
    setErrors((e) => {
      if (!(field in e)) return e
      const next = { ...e }
      delete next[field]
      return next
    })

  const commissionValue =
    commissionType === 'PhanTram' ? (percent.trim() === '' ? NaN : Number(percent)) : (fixed ?? NaN)
  const estimate =
    commissionType === 'PhanTram' && price !== null && Number.isFinite(commissionValue)
      ? floor1000((price * commissionValue) / 100)
      : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input: SaveServiceInput = {
      code: codeValue.trim().toUpperCase(),
      name: name.trim(),
      groupId,
      durationMinutes: duration.trim() === '' ? NaN : Number(duration),
      cleanupMinutes: cleanup.trim() === '' ? 0 : Number(cleanup),
      price: price ?? 0,
      description: description.trim() || null,
      imageUrl: service?.imageUrl ?? null,
      allowOnline,
      commissionType,
      commissionValue: Number.isFinite(commissionValue) ? commissionValue : 0,
      isVisible,
    }
    const found: Record<string, string> = { ...validateService(input) }
    if (duration.trim() === '') found.durationMinutes = 'Nhập thời lượng'
    if (price === null) found.price = 'Nhập giá dịch vụ'
    if (!Number.isFinite(commissionValue)) found.commissionValue = 'Nhập mức hoa hồng'
    setErrors(found)
    if (Object.keys(found).length) return

    const onError = (err: unknown) => {
      const fields = getFieldErrors(err)
      if (Object.keys(fields).length) setErrors(fields)
      else toast.error(getErrorMessage(err))
    }
    const onSuccess = (saved: ServiceDto) => {
      const title = service ? `Đã lưu dịch vụ ${saved.name}` : `Đã thêm dịch vụ ${saved.name}`
      // UC-01 E4: vẫn lưu, nhắc dịch vụ chưa hiện trên trang đặt lịch
      if (saved.onlineWarning)
        toast.warning(title, { description: saved.onlineWarning, duration: 8000 })
      else toast.success(title)
      onClose()
    }
    if (service) update.mutate({ id: service.id, input }, { onSuccess, onError })
    else create.mutate(input, { onSuccess, onError })
  }

  const noTechnician = !!service && service.technicianCount === 0

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle>{service ? `Sửa dịch vụ ${service.code}` : 'Thêm dịch vụ'}</DialogTitle>
        <DialogDescription>
          {service
            ? 'Đổi giá chỉ áp dụng cho lịch hẹn tạo sau; lịch đã tạo giữ giá cũ.'
            : 'Thời lượng là bội số 15 phút, giá là bội số 1.000 ₫. Mã gợi ý tự động, sửa được.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid max-h-[calc(100dvh-13rem)] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[9rem_1fr]">
          <FormField label="Mã dịch vụ" required error={errors.code}>
            <Input
              autoComplete="off"
              className="font-mono uppercase"
              value={codeValue}
              placeholder={!service && nextCode.isLoading ? 'Đang lấy mã…' : 'vd: DV031'}
              disabled={saving}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                clearError('code')
              }}
            />
          </FormField>
          <FormField label="Tên dịch vụ" required error={errors.name}>
            <Input
              autoComplete="off"
              autoFocus
              value={name}
              placeholder="vd: Ủ tóc phục hồi collagen"
              disabled={saving}
              onChange={(e) => {
                setName(e.target.value)
                clearError('name')
              }}
            />
          </FormField>
        </div>

        <FormField label="Nhóm dịch vụ" required error={errors.groupId} htmlFor="service-group">
          <Select
            value={groupId}
            disabled={saving}
            onValueChange={(v) => {
              setGroupId(v)
              clearError('groupId')
            }}
          >
            <SelectTrigger id="service-group" aria-invalid={errors.groupId ? true : undefined}>
              <SelectValue placeholder="Chọn nhóm" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                  {!g.isVisible && <span className="text-muted-foreground"> (nhóm đang ẩn)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Giá" required error={errors.price} hint="Bội số 1.000 ₫">
          <MoneyInput
            value={price}
            disabled={saving}
            placeholder="vd: 250.000"
            onValueChange={(v) => {
              setPrice(v)
              clearError('price')
            }}
          />
        </FormField>

        <FormField
          label="Thời lượng"
          required
          error={errors.durationMinutes}
          hint="Bội số 15 phút, từ 15 đến 240 phút"
        >
          <UnitInput
            unit="phút"
            type="number"
            inputMode="numeric"
            min={bookingRules.durationMin}
            max={bookingRules.durationMax}
            step={15}
            value={duration}
            disabled={saving}
            onChange={(e) => {
              setDuration(e.target.value)
              clearError('durationMinutes')
            }}
          />
        </FormField>

        <FormField
          label="Thời gian dọn"
          error={errors.cleanupMinutes}
          hint="Bội số 5 phút, từ 0 đến 30 phút, tính sau giờ kết thúc"
        >
          <UnitInput
            unit="phút"
            type="number"
            inputMode="numeric"
            min={0}
            max={bookingRules.cleanupMax}
            step={5}
            value={cleanup}
            disabled={saving}
            onChange={(e) => {
              setCleanup(e.target.value)
              clearError('cleanupMinutes')
            }}
          />
        </FormField>

        <FormField label="Kiểu hoa hồng" htmlFor="service-commission-type">
          <Select
            value={commissionType}
            disabled={saving}
            onValueChange={(v) => {
              setCommissionType(v as CommissionType)
              clearError('commissionValue')
            }}
          >
            <SelectTrigger id="service-commission-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMISSION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {commissionTypeLabels[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {commissionType === 'PhanTram' ? (
          <FormField
            label="Mức hoa hồng"
            required
            error={errors.commissionValue}
            hint={
              estimate !== null
                ? `Từ 0 đến 50%, ≈ ${formatVnd(estimate)} mỗi lượt với giá hiện tại`
                : 'Từ 0 đến 50% giá dịch vụ'
            }
          >
            <UnitInput
              unit="%"
              type="number"
              inputMode="decimal"
              min={0}
              max={bookingRules.maxCommissionPercent}
              step={0.5}
              value={percent}
              disabled={saving}
              onChange={(e) => {
                setPercent(e.target.value)
                clearError('commissionValue')
              }}
            />
          </FormField>
        ) : (
          <FormField
            label="Mức hoa hồng"
            required
            error={errors.commissionValue}
            hint="Số tiền cố định mỗi lượt, bội số 1.000 ₫"
          >
            <MoneyInput
              value={fixed}
              disabled={saving}
              placeholder="vd: 30.000"
              onValueChange={(v) => {
                setFixed(v)
                clearError('commissionValue')
              }}
            />
          </FormField>
        )}

        <FormField label="Mô tả" error={errors.description} className="sm:col-span-2">
          <Textarea
            rows={3}
            maxLength={1000}
            value={description}
            disabled={saving}
            placeholder="Các bước làm, lợi ích; hiện trên trang đặt lịch online"
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormField>

        <SwitchRow
          id="service-allow-online"
          label="Cho đặt online"
          description="Khách tự chọn dịch vụ này trên trang đặt lịch."
          checked={allowOnline}
          disabled={saving}
          onCheckedChange={setAllowOnline}
        />
        <SwitchRow
          id="service-visible"
          label="Đang hiện"
          description="Tắt để ẩn khỏi hộp tạo lịch, trang đặt online, hộp bán gói."
          checked={isVisible}
          disabled={saving}
          onCheckedChange={setIsVisible}
        />

        {allowOnline && (noTechnician || !service) && (
          <p
            className="bg-warning/10 text-warning border-warning/25 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm sm:col-span-2"
            role="note"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {noTechnician
              ? 'Chưa có kỹ thuật viên làm được dịch vụ này nên dịch vụ chưa hiện trên trang đặt lịch. Tick dịch vụ cho kỹ thuật viên ở trang Nhân viên.'
              : 'Dịch vụ mới chỉ hiện trên trang đặt lịch khi có ít nhất một kỹ thuật viên làm được (tick ở trang Nhân viên).'}
          </p>
        )}
      </div>

      <DialogFooter className="border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {service ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Ô số có đơn vị ở cuối ("phút", "%"); nhận mọi thuộc tính của Input để FormField gắn id, aria. */
function UnitInput({
  unit,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className="relative">
      <Input className={cn('pr-12 tabular-nums', className)} {...props} />
      <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
        {unit}
      </span>
    </div>
  )
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs leading-snug">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
    </div>
  )
}
