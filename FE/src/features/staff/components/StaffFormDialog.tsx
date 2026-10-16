'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type {
  AffectedAppointment,
  SaveStaffMemberInput,
  ServiceDto,
  ShiftType,
  StaffKind,
  StaffMemberDto,
} from '@/types/spa'
import { AffectedList } from '@/features/booking/components/AffectedList'
import {
  useAccountCandidates,
  useCreateStaff,
  useServices,
  useUpdateStaff,
} from '@/features/booking/hooks/use-spa'
import { staffKindLabels } from '@/features/booking/lib/labels'
import { problemAffected } from '@/features/booking/lib/problem'
import { digitsOnly } from '@/features/booking/lib/rules'
import { validateStaff } from '@/features/booking/lib/validation'
import { weekdayLabel } from '@/features/booking/lib/vn-time'
import { catalogService } from '@/features/booking/services/catalog.service'
import { ShiftSelect } from './ShiftSelect'

/** `member` null là thêm mới */
export type StaffDialogTarget = { member: StaffMemberDto | null }

/** Màu gợi ý cho cột KTV trên lưới lịch (dữ liệu nhân viên, không phải màu giao diện) */
const PRESET_COLORS = [
  '#E11D48',
  '#DB2777',
  '#7C3AED',
  '#2563EB',
  '#0891B2',
  '#059669',
  '#65A30D',
  '#D97706',
  '#EA580C',
  '#64748B',
]

const KINDS: StaffKind[] = ['KyThuatVien', 'LeTan']
const NO_ACCOUNT = 'none'
const DEFAULT_SHIFTS: ShiftType[] = Array<ShiftType>(7).fill('CaNgay')

/** Thêm, sửa hồ sơ nhân viên (UC-02 bước 2–3, 2a, E1, E3; FR-05). Thêm KTV mới kèm lịch tuần (FR-06). */
export function StaffFormDialog({
  target,
  onOpenChange,
}: {
  target: StaffDialogTarget | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {target && (
          <StaffForm
            key={target.member?.id ?? 'new'}
            member={target.member}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function StaffForm({ member, onClose }: { member: StaffMemberDto | null; onClose: () => void }) {
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const saving = create.isPending || update.isPending
  const services = useServices()
  const accounts = useAccountCandidates()
  const nextCode = useQuery({
    queryKey: ['spa', 'staff-next-code'],
    queryFn: catalogService.nextStaffCode,
    enabled: !member,
    staleTime: 0,
  })

  const [code, setCode] = useState<string | null>(member?.code ?? null)
  const [fullName, setFullName] = useState(member?.fullName ?? '')
  const [phone, setPhone] = useState(member?.phone ?? '')
  const [kind, setKind] = useState<StaffKind>(member?.kind ?? 'KyThuatVien')
  const [color, setColor] = useState((member?.color ?? PRESET_COLORS[0]).toUpperCase())
  const [specialty, setSpecialty] = useState(member?.specialty ?? '')
  const [userId, setUserId] = useState(member?.userId ?? NO_ACCOUNT)
  const [serviceIds, setServiceIds] = useState<string[]>(member?.serviceIds ?? [])
  const [shifts, setShifts] = useState<ShiftType[]>(DEFAULT_SHIFTS)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [affected, setAffected] = useState<AffectedAppointment[]>([])

  const codeValue = code ?? nextCode.data?.code ?? ''
  const technician = kind === 'KyThuatVien'
  const clearError = (field: string) =>
    setErrors((e) => {
      if (!(field in e)) return e
      const next = { ...e }
      delete next[field]
      return next
    })

  // Dịch vụ gom theo nhóm, giữ thứ tự nhóm của API
  const serviceGroups = useMemo(() => {
    const map = new Map<string, { name: string; items: ServiceDto[] }>()
    for (const s of services.data ?? []) {
      const g = map.get(s.groupId) ?? { name: s.groupName, items: [] }
      g.items.push(s)
      map.set(s.groupId, g)
    }
    return [...map.entries()].map(([id, g]) => ({ id, ...g }))
  }, [services.data])

  const toggleService = (id: string, checked: boolean) => {
    setServiceIds((list) => (checked ? [...new Set([...list, id])] : list.filter((x) => x !== id)))
    setAffected([])
  }
  const toggleGroup = (items: ServiceDto[], checked: boolean) => {
    const ids = items.map((s) => s.id)
    setServiceIds((list) =>
      checked ? [...new Set([...list, ...ids])] : list.filter((x) => !ids.includes(x))
    )
    setAffected([])
  }

  const selectedAccount = accounts.data?.find((a) => a.id === userId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const input: SaveStaffMemberInput = {
      code: codeValue.trim().toUpperCase(),
      fullName: fullName.trim(),
      phone: digitsOnly(phone),
      kind,
      color: color.toUpperCase(),
      specialty: specialty.trim() || null,
      userId: userId === NO_ACCOUNT ? null : userId,
      serviceIds: technician ? serviceIds : [],
      shifts: !member && technician ? shifts : undefined,
    }
    const found = validateStaff(input)
    setErrors(found)
    setAffected([])
    if (Object.keys(found).length) return

    const onError = (err: unknown) => {
      // UC-02 E1: bỏ dịch vụ làm được mà còn lịch hẹn → liệt kê lịch bị ảnh hưởng, giữ nguyên form
      const list = problemAffected(err)
      if (list.length) {
        setAffected(list)
        toast.error(getErrorMessage(err))
        return
      }
      const fields = getFieldErrors(err)
      if (Object.keys(fields).length) setErrors(fields)
      else toast.error(getErrorMessage(err))
    }
    const onSuccess = (saved: StaffMemberDto) => {
      toast.success(
        member ? `Đã lưu hồ sơ ${saved.fullName}` : `Đã thêm nhân viên ${saved.fullName}`
      )
      onClose()
    }
    if (member) update.mutate({ id: member.id, input }, { onSuccess, onError })
    else create.mutate(input, { onSuccess, onError })
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle>{member ? `Sửa hồ sơ ${member.fullName}` : 'Thêm nhân viên'}</DialogTitle>
        <DialogDescription>
          {technician
            ? 'Kỹ thuật viên hiện thành cột trên lưới lịch hẹn ở các ngày có ca và nhận lịch các dịch vụ được tick.'
            : 'Lễ tân không có ca trên lưới lịch, được chọn làm người tư vấn khi bán gói.'}
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[calc(100dvh-13rem)] space-y-5 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr_12rem]">
          <FormField label="Mã" required error={errors.code}>
            <Input
              autoComplete="off"
              className="font-mono uppercase"
              value={codeValue}
              placeholder={!member && nextCode.isLoading ? 'Đang lấy…' : 'vd: NV09'}
              disabled={saving}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                clearError('code')
              }}
            />
          </FormField>
          <FormField label="Họ tên" required error={errors.fullName}>
            <Input
              autoComplete="off"
              autoFocus
              value={fullName}
              placeholder="vd: Huỳnh Kim Ngân"
              disabled={saving}
              onChange={(e) => {
                setFullName(e.target.value)
                clearError('fullName')
              }}
            />
          </FormField>
          <FormField label="Số điện thoại" required error={errors.phone}>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              placeholder="vd: 0905 112 209"
              disabled={saving}
              onChange={(e) => {
                setPhone(e.target.value)
                clearError('phone')
              }}
            />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Loại nhân viên" required htmlFor="staff-kind">
            <Select
              value={kind}
              disabled={saving}
              onValueChange={(v) => {
                setKind(v as StaffKind)
                setAffected([])
              }}
            >
              <SelectTrigger id="staff-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {staffKindLabels[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Chuyên môn" error={errors.specialty}>
            <Input
              autoComplete="off"
              maxLength={200}
              value={specialty}
              placeholder="vd: Chăm sóc da, massage body"
              disabled={saving}
              onChange={(e) => setSpecialty(e.target.value)}
            />
          </FormField>

          <FormField
            label="Màu trên lịch"
            required
            error={errors.color}
            hint="Màu cột và thẻ lịch hẹn của nhân viên trên lưới"
          >
            <div className="flex flex-wrap items-center gap-2" role="group">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setColor(c)
                    clearError('color')
                  }}
                  aria-label={`Chọn màu ${c}`}
                  aria-pressed={color === c}
                  className="focus-visible:ring-ring/50 aria-pressed:ring-foreground ring-offset-background size-7 cursor-pointer rounded-full ring-2 ring-transparent ring-offset-2 outline-none focus-visible:ring-3"
                  style={{ backgroundColor: c }}
                />
              ))}
              <Input
                type="color"
                aria-label="Màu khác"
                className="h-8 w-12 cursor-pointer p-1"
                value={color.toLowerCase()}
                disabled={saving}
                onChange={(e) => {
                  setColor(e.target.value.toUpperCase())
                  clearError('color')
                }}
              />
            </div>
          </FormField>

          <FormField
            label="Tài khoản đăng nhập"
            error={errors.userId}
            htmlFor="staff-account"
            hint={
              selectedAccount?.linkedStaffId && selectedAccount.linkedStaffId !== member?.id
                ? `Tài khoản đang liên kết với ${selectedAccount.linkedStaffName}`
                : 'Liên kết để nhân viên xem lịch, hoa hồng của mình'
            }
          >
            <Select
              value={userId}
              disabled={saving || accounts.isLoading}
              onValueChange={(v) => {
                setUserId(v)
                clearError('userId')
              }}
            >
              <SelectTrigger id="staff-account" aria-invalid={errors.userId ? true : undefined}>
                <SelectValue placeholder={accounts.isLoading ? 'Đang tải…' : 'Không liên kết'}>
                  {userId === NO_ACCOUNT
                    ? 'Không liên kết'
                    : selectedAccount
                      ? `${selectedAccount.username} · ${selectedAccount.fullName}`
                      : (member?.username ?? undefined)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ACCOUNT}>Không liên kết</SelectItem>
                {(accounts.data ?? []).map((a) => {
                  const linkedOther = !!a.linkedStaffId && a.linkedStaffId !== member?.id
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono text-xs">{a.username}</span>
                      <span>· {a.fullName}</span>
                      {linkedOther && (
                        <span className="text-warning text-xs">
                          (đã liên kết {a.linkedStaffName})
                        </span>
                      )}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {technician && (
          <fieldset className="space-y-3">
            <legend className="flex w-full flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
              <span>Dịch vụ làm được</span>
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                Đã chọn {serviceIds.length} dịch vụ
              </span>
            </legend>
            {services.isLoading ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {serviceGroups.map((g) => {
                  const selected = g.items.filter((s) => serviceIds.includes(s.id)).length
                  const groupState =
                    selected === 0 ? false : selected === g.items.length ? true : 'indeterminate'
                  const groupId = `staff-group-${g.id}`
                  return (
                    <div key={g.id} className="rounded-lg border">
                      <label
                        htmlFor={groupId}
                        className="bg-muted/40 flex cursor-pointer items-center gap-2 border-b px-3 py-2"
                      >
                        <Checkbox
                          id={groupId}
                          checked={groupState}
                          disabled={saving}
                          onCheckedChange={(v) => toggleGroup(g.items, v === true)}
                        />
                        <span className="text-sm font-semibold">{g.name}</span>
                        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                          {selected}/{g.items.length}
                        </span>
                      </label>
                      <ul className="space-y-0.5 p-1.5">
                        {g.items.map((s) => {
                          const id = `staff-service-${s.id}`
                          const checked = serviceIds.includes(s.id)
                          return (
                            <li key={s.id}>
                              <label
                                htmlFor={id}
                                className={cn(
                                  'flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors duration-150',
                                  checked ? 'bg-primary/5' : 'hover:bg-muted/60'
                                )}
                              >
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  disabled={saving}
                                  onCheckedChange={(v) => toggleService(s.id, v === true)}
                                />
                                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                                {!s.isVisible && (
                                  <span className="text-muted-foreground text-xs">Đang ẩn</span>
                                )}
                                <span className="text-muted-foreground font-mono text-xs">
                                  {s.code}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
            {errors.serviceIds && (
              <p role="alert" className="text-destructive text-[0.8125rem]">
                {errors.serviceIds}
              </p>
            )}
          </fieldset>
        )}

        {technician && !member && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Lịch tuần</legend>
            <p className="text-muted-foreground -mt-1 text-xs">
              Đổi sau ở tab Lịch tuần. Mặc định cả ngày mọi thứ.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {shifts.map((shift, i) => (
                <div key={i} className="grid gap-1">
                  <span className="text-muted-foreground text-xs font-medium">
                    {weekdayLabel(i + 1)}
                  </span>
                  <ShiftSelect
                    value={shift}
                    disabled={saving}
                    aria-label={`Ca ${weekdayLabel(i + 1)}`}
                    onChange={(v) => setShifts((list) => list.map((x, j) => (j === i ? v : x)))}
                  />
                </div>
              ))}
            </div>
            {errors.shifts && (
              <p role="alert" className="text-destructive text-[0.8125rem]">
                {errors.shifts}
              </p>
            )}
          </fieldset>
        )}

        <AffectedList items={affected} />
      </div>

      <DialogFooter className="border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {member ? 'Lưu hồ sơ' : 'Thêm nhân viên'}
        </Button>
      </DialogFooter>
    </form>
  )
}
