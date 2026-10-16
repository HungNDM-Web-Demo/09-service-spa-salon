'use client'

import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Lightbulb, Loader2, Lock, Package, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDebounce } from '@/hooks/use-debounce'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  AppointmentDetailDto,
  AppointmentSource,
  CheckAppointmentInput,
  CustomerPackageBrief,
  Issue,
  ServiceOption,
  SuggestionsDto,
} from '@/types/spa'
import { CustomerPicker } from '@/features/booking/components/CustomerPicker'
import { FlaggedBadge } from '@/features/booking/components/SpaBadges'
import {
  useBusinessHours,
  useCreateAppointment,
  useCustomerLookup,
  useServiceOptions,
  useStaffOptions,
  useUpdateAppointment,
} from '@/features/booking/hooks/use-spa'
import { counterSourceOptions, sourceLabels } from '@/features/booking/lib/labels'
import { problemLines } from '@/features/booking/lib/problem'
import { PHONE_PATTERN, bookingRules, digitsOnly, floor15 } from '@/features/booking/lib/rules'
import { nextLineStart } from '@/features/booking/lib/schedule'
import { appointmentService } from '@/features/booking/services/booking.service'
import { hhmm, parseHhmm, vnIso, vnMinutesOfDay, vnNow, vnToday } from '@/features/booking/lib/vn-time'

export type AppointmentDialogTarget =
  | { mode: 'create'; date: string; staffId?: string; start?: number }
  | { mode: 'edit'; appointment: AppointmentDetailDto }

type AppointmentDialogProps = {
  target: AppointmentDialogTarget | null
  onOpenChange: (open: boolean) => void
  onSaved?: (appointment: AppointmentDetailDto) => void
}

/** Hộp tạo, sửa lịch hẹn (SCR-03; UC-03, UC-05 3b, UC-07 bước 4). */
export function AppointmentDialog({ target, onOpenChange, onSaved }: AppointmentDialogProps) {
  const key = !target ? 'closed' : target.mode === 'create' ? `c-${target.date}-${target.staffId}-${target.start}` : `e-${target.appointment.id}`
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        {target && <AppointmentForm key={key} target={target} onClose={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

type LineDraft = {
  key: string
  lineId?: string
  serviceId: string
  staffId: string
  start: number | null
  /** Dòng của lịch đang phục vụ đã tới giờ bắt đầu: không đổi, không bỏ được */
  locked: boolean
  fallbackName?: string
  /** Giờ do hệ thống tự điền khi "Thêm dịch vụ": đổi KTV thì tính lại theo dòng trước (UC-03 bước 5) */
  autoStart?: boolean
}

let keySeq = 0
const newKey = () => `l${++keySeq}`

function initialLines(target: AppointmentDialogTarget): LineDraft[] {
  if (target.mode === 'create')
    return [{ key: newKey(), serviceId: '', staffId: target.staffId ?? '', start: target.start ?? null, locked: false }]
  const a = target.appointment
  const now = new Date(vnNow()).toISOString()
  return [...a.lines]
    .sort((x, y) => x.sortOrder - y.sortOrder)
    .map((l) => ({
      key: newKey(),
      lineId: l.id,
      serviceId: l.serviceId,
      staffId: l.staffMemberId,
      start: vnMinutesOfDay(l.startAt),
      locked: a.status === 'DangPhucVu' && l.startAt <= now,
      fallbackName: l.serviceName,
    }))
}

function AppointmentForm({
  target,
  onClose,
  onSaved,
}: {
  target: AppointmentDialogTarget
  onClose: () => void
  onSaved?: (a: AppointmentDetailDto) => void
}) {
  const editing = target.mode === 'edit' ? target.appointment : null
  const inService = editing?.status === 'DangPhucVu'
  const [date, setDate] = useState(editing ? editing.date : target.mode === 'create' ? target.date : vnToday())
  const [lines, setLines] = useState<LineDraft[]>(() => initialLines(target))
  const [phone, setPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [source, setSource] = useState<AppointmentSource>(editing?.source ?? 'DienThoai')
  const [note, setNote] = useState(editing?.note ?? '')
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionsDto | 'loading'>>({})
  const [saveError, setSaveError] = useState<{ message: string; lineIssues: Record<number, Issue[]>; fields: Record<string, string> } | null>(null)

  const services = useServiceOptions()
  const staff = useStaffOptions()
  const hours = useBusinessHours()
  const phoneDigits = digitsOnly(phone)
  const lookup = useCustomerLookup(editing ? '' : phoneDigits)
  const create = useCreateAppointment()
  const update = useUpdateAppointment()
  const saving = create.isPending || update.isPending

  const open = hours.data ? parseHhmm(hours.data.openTime) : bookingRules.defaultOpen
  const close = hours.data ? parseHhmm(hours.data.closeTime) : bookingRules.defaultClose
  const today = vnToday()
  const minStart = date === today ? floor15(vnMinutesOfDay(vnNow())) : open

  const serviceMap = useMemo(() => new Map((services.data ?? []).map((s) => [s.id, s])), [services.data])
  const technicians = useMemo(() => (staff.data ?? []).filter((s) => s.kind === 'KyThuatVien'), [staff.data])
  const staffName = (id: string) => staff.data?.find((s) => s.id === id)?.fullName ?? '—'
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: ServiceOption[] }>()
    for (const s of services.data ?? []) {
      const g = map.get(s.groupId) ?? { name: s.groupName, items: [] }
      g.items.push(s)
      map.set(s.groupId, g)
    }
    return [...map.values()]
  }, [services.data])

  const customer = editing ? editing.customer : (lookup.data?.customer ?? null)
  const packages: CustomerPackageBrief[] = editing ? editing.packages : (lookup.data?.packages ?? [])

  // Kiểm tra trùng lịch ngay khi đủ dịch vụ, KTV, giờ (FR-10)
  const complete = lines.every((l) => l.serviceId && l.staffId && l.start !== null)
  const checkInput: CheckAppointmentInput | null = complete
    ? {
        appointmentId: editing?.id,
        customerId: customer?.id,
        lines: lines.map((l) => ({ lineId: l.lineId, serviceId: l.serviceId, staffMemberId: l.staffId, startAt: vnIso(date, l.start!) })),
      }
    : null
  const debounced = useDebounce(checkInput, 250)
  const check = useQuery({
    queryKey: ['spa', 'appointment-check', debounced],
    queryFn: () => appointmentService.check(debounced!),
    enabled: !!debounced,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
  const checkFresh = !!checkInput && JSON.stringify(checkInput) === JSON.stringify(debounced) && !check.isFetching
  const checkResult = checkFresh ? check.data : undefined

  const update_ = (key: string, patch: Partial<LineDraft>) => {
    setLines((list) =>
      list.map((l, i) => {
        if (l.key !== key) return l
        const next = { ...l, ...patch }
        if (patch.start !== undefined) next.autoStart = false
        else if (patch.staffId !== undefined && l.autoStart && i > 0) {
          const prev = list[i - 1]
          const svc = serviceMap.get(prev.serviceId)
          if (svc && prev.start !== null)
            next.start = nextLineStart(
              { start: prev.start, duration: svc.durationMinutes, cleanup: svc.cleanupMinutes, staffId: prev.staffId },
              patch.staffId
            )
        }
        return next
      })
    )
    setSaveError(null)
    setSuggestions((s) => {
      if (!(key in s)) return s
      const next = { ...s }
      delete next[key]
      return next
    })
  }

  const addLine = () => {
    const last = lines[lines.length - 1]
    const svc = last ? serviceMap.get(last.serviceId) : undefined
    const start =
      last && svc && last.start !== null
        ? nextLineStart({ start: last.start, duration: svc.durationMinutes, cleanup: svc.cleanupMinutes, staffId: last.staffId }, last.staffId)
        : null
    setLines((list) => [...list, { key: newKey(), serviceId: '', staffId: last?.staffId ?? '', start, locked: false, autoStart: start !== null }])
  }

  const askSuggest = async (line: LineDraft) => {
    if (!line.serviceId || !line.staffId || line.start === null) return
    setSuggestions((s) => ({ ...s, [line.key]: 'loading' }))
    try {
      const result = await appointmentService.suggest({
        serviceId: line.serviceId,
        staffMemberId: line.staffId,
        startAt: vnIso(date, line.start),
        appointmentId: editing?.id,
      })
      setSuggestions((s) => ({ ...s, [line.key]: result }))
    } catch (err) {
      toast.error(getErrorMessage(err))
      setSuggestions((s) => {
        const next = { ...s }
        delete next[line.key]
        return next
      })
    }
  }

  const phoneValid = PHONE_PATTERN.test(phoneDigits)
  const needsName = !editing && phoneValid && !!lookup.data && !lookup.data.customer
  const customerReady = editing ? true : phoneValid && !!lookup.data && (!!lookup.data.customer || newName.trim().length > 0)
  const canSave = customerReady && complete && !saving && checkResult?.ok === true

  const save = () => {
    if (!canSave || !checkInput) return
    setSaveError(null)
    const onError = (err: unknown) => {
      const lineIssues: Record<number, Issue[]> = {}
      for (const l of problemLines(err)) lineIssues[l.index] = l.issues
      const fields = getFieldErrors(err)
      setSaveError({ message: getErrorMessage(err), lineIssues, fields })
      void check.refetch()
    }
    const onSuccess = (a: AppointmentDetailDto) => {
      toast.success(editing ? `Đã lưu lịch ${a.code}` : `Đã tạo lịch ${a.code}, đã gửi tin xác nhận (giả lập)`)
      onSaved?.(a)
      onClose()
    }
    if (editing) {
      update.mutate({ id: editing.id, input: { source, note: note.trim() || null, lines: checkInput.lines } }, { onSuccess, onError })
    } else {
      create.mutate(
        {
          customerId: lookup.data?.customer?.id,
          newCustomer: lookup.data?.customer ? undefined : { phone: phoneDigits, fullName: newName.trim() },
          source,
          note: note.trim() || null,
          lines: checkInput.lines,
        },
        { onSuccess, onError }
      )
    }
  }

  const timeOptions = (line: LineDraft) => {
    const svc = serviceMap.get(line.serviceId)
    const duration = svc?.durationMinutes ?? 15
    const list: number[] = []
    for (let t = open; t + duration <= close; t += bookingRules.slotStep) if (t >= minStart || t === line.start) list.push(t)
    if (line.start !== null && !list.includes(line.start)) list.unshift(line.start)
    return list
  }

  const total = lines.reduce((s, l) => s + (serviceMap.get(l.serviceId)?.price ?? 0), 0)
  const globalIssues = checkResult?.issues ?? []

  return (
    <>
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle>{editing ? `Sửa lịch hẹn ${editing.code}` : 'Tạo lịch hẹn'}</DialogTitle>
        <DialogDescription>
          {inService
            ? 'Thêm dịch vụ khách muốn làm thêm hoặc bỏ dịch vụ chưa làm. Dòng đã bắt đầu được giữ nguyên.'
            : 'Chọn dịch vụ, kỹ thuật viên và giờ; hệ thống kiểm tra trùng lịch ngay dưới từng dòng.'}
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[calc(100svh-13rem)] space-y-5 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          {editing ? (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Khách hàng</p>
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {editing.customerName}
                <span className="text-muted-foreground font-normal tabular-nums">{editing.customerPhone}</span>
                {editing.customer.isFlagged && <FlaggedBadge count={editing.customer.noShowCount90} />}
              </p>
              {editing.customer.note && <p className="text-muted-foreground">Ghi chú: {editing.customer.note}</p>}
            </div>
          ) : (
            <CustomerPicker
              phone={phone}
              onPhoneChange={(v) => {
                setPhone(v)
                setSaveError(null)
              }}
              newName={newName}
              onNewNameChange={setNewName}
              lookup={lookup.data}
              isLooking={lookup.isFetching}
              autoFocus
              errors={{
                phone: saveError?.fields['newCustomer.phone'],
                name: saveError?.fields['newCustomer.fullName'] ?? (needsName && saveError && !newName.trim() ? 'Nhập họ tên khách' : undefined),
              }}
            />
          )}
          <FormField label="Ngày hẹn" required>
            <Input
              type="date"
              value={date}
              min={today}
              disabled={inService || saving}
              onChange={(e) => {
                if (!e.target.value) return
                setDate(e.target.value)
                setSaveError(null)
              }}
            />
          </FormField>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Dịch vụ</p>
          {lines.map((line, index) => {
            const svc = serviceMap.get(line.serviceId)
            const issues = saveError?.lineIssues[index] ?? checkResult?.lines.find((l) => l.index === index)?.issues ?? []
            const lineOk = checkResult && issues.length === 0
            const pkg = packages.find(
              (p) => p.serviceId === line.serviceId && p.status === 'DangDung' && p.remaining > 0 && p.expiryDate >= date
            )
            const capable = svc ? technicians.filter((t) => svc.technicianIds.includes(t.id)) : technicians
            const staffInList = !line.staffId || capable.some((t) => t.id === line.staffId)
            const sugg = suggestions[line.key]
            return (
              <div key={line.key} className={cn('rounded-lg border p-3', issues.length > 0 && 'border-destructive/50 bg-destructive/[0.03]')}>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_7.5rem_auto]">
                  <Select
                    value={line.serviceId}
                    disabled={line.locked || saving}
                    onValueChange={(v) => update_(line.key, { serviceId: v })}
                  >
                    <SelectTrigger aria-label={`Dịch vụ dòng ${index + 1}`} className="[&>span]:truncate">
                      <SelectValue placeholder="Chọn dịch vụ">{svc?.name ?? line.fallbackName}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectGroup key={g.name}>
                          <SelectLabel>{g.name}</SelectLabel>
                          {g.items.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} · {s.durationMinutes}′ · {formatVnd(s.price)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={line.staffId} disabled={line.locked || saving} onValueChange={(v) => update_(line.key, { staffId: v })}>
                    <SelectTrigger aria-label={`Kỹ thuật viên dòng ${index + 1}`} className="[&>span]:truncate">
                      <SelectValue placeholder="Kỹ thuật viên">
                        {line.staffId ? staffName(line.staffId) + (staffInList ? '' : ' · không làm được') : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {capable.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
                          {t.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={line.start === null ? '' : String(line.start)}
                    disabled={line.locked || saving}
                    onValueChange={(v) => update_(line.key, { start: Number(v) })}
                  >
                    <SelectTrigger aria-label={`Giờ bắt đầu dòng ${index + 1}`} className="tabular-nums">
                      <SelectValue placeholder="Giờ">{line.start === null ? undefined : hhmm(line.start)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions(line).map((t) => (
                        <SelectItem key={t} value={String(t)} className="tabular-nums">
                          {hhmm(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    {line.locked ? (
                      <span className="text-muted-foreground flex h-10 items-center gap-1 px-2 text-xs">
                        <Lock className="size-3.5" aria-hidden="true" />
                        Đã bắt đầu
                      </span>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Gợi ý kỹ thuật viên rảnh, giờ trống"
                          title="Gợi ý"
                          disabled={!line.serviceId || !line.staffId || line.start === null || saving}
                          onClick={() => askSuggest(line)}
                        >
                          {sugg === 'loading' ? <Loader2 className="animate-spin" /> : <Lightbulb />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Bỏ dòng ${index + 1}`}
                          disabled={lines.length <= 1 || saving}
                          onClick={() => setLines((list) => list.filter((l) => l.key !== line.key))}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
                  {svc && line.start !== null && (
                    <span className="text-muted-foreground tabular-nums">
                      {hhmm(line.start)}–{hhmm(line.start + svc.durationMinutes)}
                      {svc.cleanupMinutes > 0 && ` (+${svc.cleanupMinutes} phút dọn)`} · {formatVnd(svc.price)}
                    </span>
                  )}
                  {pkg && (
                    <span className="text-primary inline-flex items-center gap-1 font-medium">
                      <Package className="size-3.5" aria-hidden="true" />
                      Dùng gói, còn {pkg.remaining} buổi
                    </span>
                  )}
                  {lineOk && complete && (
                    <span className="text-success inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Trống
                    </span>
                  )}
                </div>
                {issues.map((issue, i) => (
                  <p key={i} role="alert" className="text-destructive mt-1 flex items-start gap-1 text-[0.8125rem]">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {issue.message}
                  </p>
                ))}
                {sugg && sugg !== 'loading' && (
                  <div className="bg-muted/50 mt-2 space-y-2 rounded-md p-2 text-[0.8125rem]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground">KTV rảnh lúc {line.start !== null ? hhmm(line.start) : ''}:</span>
                      {sugg.freeTechnicians.length === 0 && <span>không có</span>}
                      {sugg.freeTechnicians.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => update_(line.key, { staffId: t.id })}
                          className="bg-background hover:border-primary cursor-pointer rounded-full border px-2.5 py-0.5"
                        >
                          {t.fullName}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground">Giờ trống gần nhất của {staffName(line.staffId)}:</span>
                      {sugg.nextSlots.length === 0 && <span>không còn trong ngày</span>}
                      {sugg.nextSlots.map((iso) => (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => update_(line.key, { start: vnMinutesOfDay(iso) })}
                          className="bg-background hover:border-primary cursor-pointer rounded-full border px-2.5 py-0.5 tabular-nums"
                        >
                          {hhmm(vnMinutesOfDay(iso))}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {globalIssues.map((issue, i) => (
            <p key={i} role="alert" className="text-destructive flex items-start gap-1 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {issue.message}
            </p>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={lines.length >= bookingRules.maxLines || saving}>
            <Plus aria-hidden="true" />
            Thêm dịch vụ
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <FormField label="Nguồn">
            {editing?.source === 'Online' ? (
              <Input value={sourceLabels.Online} disabled />
            ) : (
              <Select value={source} onValueChange={(v) => setSource(v as AppointmentSource)} disabled={saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {counterSourceOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Ghi chú lịch hẹn">
            <Textarea
              rows={2}
              maxLength={500}
              value={note}
              disabled={saving}
              placeholder="Vd khách muốn phòng riêng, đi cùng bạn"
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>
        </div>

        {saveError && saveError.message && Object.keys(saveError.lineIssues).length === 0 && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
            {saveError.message}
          </p>
        )}
      </div>

      <DialogFooter className="items-center border-t px-6 py-4 sm:justify-between">
        <p className="text-sm">
          Tạm tính: <span className="font-semibold tabular-nums">{formatVnd(total)}</span>
          {checkInput && check.isFetching && <Loader2 className="text-muted-foreground ml-2 inline size-4 animate-spin" aria-label="Đang kiểm tra" />}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={save} disabled={!canSave}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {editing ? 'Lưu thay đổi' : 'Lưu lịch hẹn'}
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}
