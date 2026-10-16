'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, CheckCircle2, Clock, Loader2, Search, Sparkles, UserRound, Users } from 'lucide-react'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { routePath } from '@/config/route-path'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PublicAppointmentDto, PublicCatalogDto } from '@/types/spa'
import { AppointmentStatusBadge } from '@/features/booking/components/SpaBadges'
import { usePublicBook, usePublicCatalog, usePublicSlots } from '@/features/booking/hooks/use-spa'
import { problemCode } from '@/features/booking/lib/problem'
import { PHONE_PATTERN, bookingRules, digitsOnly } from '@/features/booking/lib/rules'
import { addDaysKey, ddmmyyyy, hhmm, isoWeekdayOf, parseHhmm, vnHhmm, vnIso, vnToday, weekdayLabel, weekdayShort } from '@/features/booking/lib/vn-time'

type Service = PublicCatalogDto['groups'][number]['services'][number]
const STEPS = ['Dịch vụ', 'Kỹ thuật viên', 'Ngày giờ', 'Thông tin']

/** Đặt lịch online (SCR-07, UC-04): 4 bước chọn dịch vụ, KTV, ngày giờ trống, thông tin; xong hiện mã lịch. */
export function BookingPage() {
  const catalog = usePublicCatalog()
  const book = usePublicBook()
  const [step, setStep] = useState(0)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [staffId, setStaffId] = useState<string | null>(null)
  const [date, setDate] = useState(vnToday())
  const [slot, setSlot] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [done, setDone] = useState<PublicAppointmentDto | null>(null)

  const services = useMemo(() => (catalog.data?.groups ?? []).flatMap((g) => g.services), [catalog.data])
  const chosen = serviceIds.map((id) => services.find((s) => s.id === id)).filter((s): s is Service => !!s)
  const totalPrice = chosen.reduce((s, x) => s + x.price, 0)
  const totalMinutes = chosen.reduce((s, x) => s + x.durationMinutes, 0)
  const technicians = (catalog.data?.technicians ?? []).filter((t) => serviceIds.every((id) => t.serviceIds.includes(id)))
  const staffName = staffId ? catalog.data?.technicians.find((t) => t.id === staffId)?.fullName : null
  const slots = usePublicSlots(step >= 2 && serviceIds.length ? { serviceIds, staffMemberId: staffId, date } : null)

  if (catalog.isLoading)
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  if (catalog.error || !catalog.data) return <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
  if (done) return <BookingSuccess result={done} />

  const toggleService = (id: string) => {
    setNotice(null)
    setSlot(null)
    setServiceIds((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : list.length >= bookingRules.onlineMaxServices ? list : [...list, id]
    )
  }

  const submit = () => {
    const local: Record<string, string> = {}
    if (!fullName.trim()) local.fullName = 'Nhập họ tên'
    if (!PHONE_PATTERN.test(digitsOnly(phone))) local.phone = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0'
    setErrors(local)
    if (Object.keys(local).length || !slot) return
    setNotice(null)
    book.mutate(
      {
        serviceIds,
        staffMemberId: staffId,
        startAt: vnIso(date, parseHhmm(slot)),
        fullName: fullName.trim(),
        phone: digitsOnly(phone),
        note: note.trim() || null,
      },
      {
        onSuccess: setDone,
        onError: (err) => {
          const code = problemCode(err)
          if (code === 'GioDaCoNguoiDat' || code === 'TrungLichKhach') {
            // Giờ vừa bị người khác đặt: quay về bước chọn giờ (UC-04 E1, NFR-04)
            setNotice(getErrorMessage(err))
            setSlot(null)
            setStep(2)
            void slots.refetch()
            return
          }
          const fields = getFieldErrors(err)
          setErrors(fields)
          setNotice(
            code === 'QuaSoLichCho' && catalog.data?.shop.hotline
              ? `${getErrorMessage(err)}: ${catalog.data.shop.hotline}`
              : Object.keys(fields).length
                ? null
                : getErrorMessage(err)
          )
        },
      }
    )
  }

  const canNext = step === 0 ? serviceIds.length > 0 : step === 1 ? true : step === 2 ? !!slot : true
  const days = Array.from({ length: bookingRules.onlineMaxDaysAhead + 1 }, (_, i) => addDaysKey(vnToday(), i))

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-1.5" aria-label="Các bước đặt lịch">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1">
            <span className={cn('h-1.5 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
            <span className={cn('text-xs', i === step ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {notice && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2.5 text-sm font-medium">
          {notice}
        </p>
      )}

      {step === 0 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-xl font-semibold">Chọn dịch vụ</h1>
            <p className="text-muted-foreground text-sm">Chọn tối đa {bookingRules.onlineMaxServices} dịch vụ cho một lần hẹn.</p>
          </div>
          {catalog.data.groups.map((g) => (
            <div key={g.id} className="space-y-2">
              <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">{g.name}</h2>
              {g.services.map((s) => {
                const selected = serviceIds.includes(s.id)
                const full = !selected && serviceIds.length >= bookingRules.onlineMaxServices
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={full}
                    onClick={() => toggleService(s.id)}
                    className={cn(
                      'bg-card flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      selected ? 'border-primary ring-primary/30 ring-2' : 'hover:border-primary/40'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                        selected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background'
                      )}
                      aria-hidden="true"
                    >
                      {selected && <Check className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{s.name}</span>
                      {s.description && <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-sm">{s.description}</span>}
                      <span className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                        <Clock className="size-3" aria-hidden="true" />
                        {s.durationMinutes} phút
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatVnd(s.price)}</span>
                  </button>
                )
              })}
            </div>
          ))}
          <Link href={routePath.bookingLookup} className="text-primary flex items-center justify-center gap-1.5 pt-2 text-sm font-medium">
            <Search className="size-4" aria-hidden="true" />
            Tra cứu, hủy lịch đã đặt
          </Link>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <div>
            <h1 className="text-xl font-semibold">Chọn kỹ thuật viên</h1>
            <p className="text-muted-foreground text-sm">Chỉ hiện người làm được tất cả dịch vụ bạn chọn.</p>
          </div>
          <StaffChoice
            selected={staffId === null}
            onClick={() => {
              setStaffId(null)
              setSlot(null)
            }}
            icon={<Users className="size-5" aria-hidden="true" />}
            title="Bất kỳ ai"
            subtitle="Tiệm xếp kỹ thuật viên phù hợp còn trống"
          />
          {technicians.map((t) => (
            <StaffChoice
              key={t.id}
              selected={staffId === t.id}
              onClick={() => {
                setStaffId(t.id)
                setSlot(null)
              }}
              icon={
                <span className="flex size-full items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: t.color }}>
                  {t.fullName.split(' ').slice(-1)[0]?.[0]}
                </span>
              }
              title={t.fullName}
              subtitle={t.specialty ?? 'Kỹ thuật viên'}
            />
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold">Chọn ngày giờ</h1>
            <p className="text-muted-foreground text-sm">Các mốc cách nhau 30 phút, đặt trước ít nhất 2 giờ.</p>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="listbox" aria-label="Ngày">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                role="option"
                aria-selected={d === date}
                aria-label={`${weekdayLabel(isoWeekdayOf(d))} ${ddmmyyyy(d)}`}
                onClick={() => {
                  setDate(d)
                  setSlot(null)
                }}
                className={cn(
                  'flex w-14 shrink-0 cursor-pointer flex-col items-center rounded-xl border py-2 transition-colors',
                  d === date ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/40'
                )}
              >
                <span className="text-xs">{d === vnToday() ? 'Nay' : weekdayShort(isoWeekdayOf(d))}</span>
                <span className="text-lg font-semibold tabular-nums">{d.slice(8)}</span>
                <span className="text-[0.6875rem] opacity-80">Th{Number(d.slice(5, 7))}</span>
              </button>
            ))}
          </div>
          {slots.isLoading || slots.isFetching ? (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          ) : slots.error ? (
            <ErrorState error={slots.error} onRetry={() => slots.refetch()} />
          ) : slots.data && slots.data.slots.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {slots.data.slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={slot === s}
                  onClick={() => {
                    setSlot(s)
                    setNotice(null)
                  }}
                  className={cn(
                    'h-11 cursor-pointer rounded-lg border text-sm font-medium tabular-nums transition-colors',
                    slot === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/40'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-card space-y-3 rounded-xl border p-5 text-center">
              <p className="font-medium">{slots.data?.closedReason ? `Tiệm nghỉ ngày này (${slots.data.closedReason})` : 'Hết chỗ'}</p>
              {slots.data?.nextAvailableDate ? (
                <Button variant="outline" onClick={() => setDate(slots.data!.nextAvailableDate!)}>
                  Ngày gần nhất còn trống: {ddmmyyyy(slots.data.nextAvailableDate)}
                </Button>
              ) : (
                <p className="text-muted-foreground text-sm">Vui lòng chọn ngày khác hoặc gọi tiệm.</p>
              )}
            </div>
          )}
        </section>
      )}

      {step === 3 && slot && (
        <section className="space-y-4">
          <h1 className="text-xl font-semibold">Thông tin của bạn</h1>
          <div className="bg-card space-y-2 rounded-xl border p-4 text-sm">
            {chosen.map((s) => (
              <div key={s.id} className="flex justify-between gap-2">
                <span>{s.name}</span>
                <span className="tabular-nums">{formatVnd(s.price)}</span>
              </div>
            ))}
            <div className="text-muted-foreground flex items-center gap-1.5 border-t pt-2">
              <UserRound className="size-4" aria-hidden="true" />
              {staffName ?? 'Tiệm xếp kỹ thuật viên phù hợp'}
            </div>
            <div className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              <span className="tabular-nums">
                {slot}–{hhmm(parseHhmm(slot) + totalMinutes)} (dự kiến), {weekdayShort(isoWeekdayOf(date))} {ddmmyyyy(date)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Tổng tiền dự kiến</span>
              <span className="tabular-nums">{formatVnd(totalPrice)}</span>
            </div>
          </div>
          <FormField label="Họ tên" required error={errors.fullName}>
            <Input autoComplete="name" value={fullName} maxLength={100} onChange={(e) => setFullName(e.target.value)} />
          </FormField>
          <FormField label="Số điện thoại" required error={errors.phone} hint="Tiệm gọi hoặc nhắn Zalo số này để xác nhận">
            <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))} />
          </FormField>
          <FormField label="Ghi chú" hint="Vd da nhạy cảm, muốn kỹ thuật viên nữ">
            <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </section>
      )}

      {/* Thanh dưới cố định: tóm tắt, quay lại, tiếp tục */}
      <div className="bg-card/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          {step > 0 && (
            <Button variant="outline" size="icon-lg" aria-label="Quay lại" onClick={() => setStep(step - 1)} disabled={book.isPending}>
              <ArrowLeft />
            </Button>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">
              {serviceIds.length ? `${serviceIds.length} dịch vụ · ${totalMinutes} phút` : 'Chưa chọn dịch vụ'}
            </p>
            <p className="font-semibold tabular-nums">{formatVnd(totalPrice)}</p>
          </div>
          {step < 3 ? (
            <Button size="lg" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Tiếp tục
            </Button>
          ) : (
            <Button size="lg" variant="cta" disabled={book.isPending} onClick={submit}>
              {book.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Đặt lịch
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function StaffChoice({
  selected,
  onClick,
  icon,
  title,
  subtitle,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'bg-card flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
        selected ? 'border-primary ring-primary/30 ring-2' : 'hover:border-primary/40'
      )}
    >
      <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="text-muted-foreground block truncate text-sm">{subtitle}</span>
      </span>
      {selected && <CheckCircle2 className="text-primary size-5 shrink-0" aria-hidden="true" />}
    </button>
  )
}

function BookingSuccess({ result }: { result: PublicAppointmentDto }) {
  const staff = [...new Set(result.lines.map((l) => l.staffName))].join(', ')
  return (
    <div className="space-y-5 pt-4 text-center">
      <span className="bg-success/12 text-success mx-auto flex size-16 items-center justify-center rounded-full">
        <Sparkles className="size-8" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Đặt lịch thành công</h1>
        <p className="text-muted-foreground text-sm">Tiệm sẽ gọi hoặc nhắn xác nhận trong 30 phút.</p>
      </div>
      <div className="bg-card space-y-3 rounded-xl border p-4 text-left text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Mã lịch hẹn</span>
          <span className="text-lg font-semibold tabular-nums">{result.code}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Trạng thái</span>
          <AppointmentStatusBadge status={result.status} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Thời gian</span>
          <span className="text-right tabular-nums">
            {vnHhmm(result.startAt)}–{vnHhmm(result.endAt)}, {ddmmyyyy(result.date)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Kỹ thuật viên</span>
          <span className="text-right">{staff}</span>
        </div>
        <ul className="space-y-1 border-t pt-2">
          {result.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {l.serviceName} <span className="text-muted-foreground tabular-nums">({vnHhmm(l.startAt)})</span>
              </span>
              <span className="tabular-nums">{formatVnd(l.price)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Tổng tiền dự kiến</span>
          <span className="tabular-nums">{formatVnd(result.total)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button asChild size="lg">
          <Link href={`${routePath.bookingLookup}?code=${encodeURIComponent(result.code)}`}>Tra cứu, hủy lịch này</Link>
        </Button>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Đặt lịch khác
        </Button>
      </div>
    </div>
  )
}
