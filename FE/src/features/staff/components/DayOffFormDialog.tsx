'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import type { AffectedAppointment, DayOffDto, StaffMemberDto } from '@/types/spa'
import { AffectedList } from '@/features/booking/components/AffectedList'
import { useCreateDayOff } from '@/features/booking/hooks/use-spa'
import { problemAffected } from '@/features/booking/lib/problem'
import { addDaysKey, ddmmyyyy, vnToday } from '@/features/booking/lib/vn-time'

/** Giá trị chọn "Cả tiệm" (staffMemberId = null) */
const WHOLE_SHOP = 'shop'

/** Lý do hay dùng, chạm một lần để điền */
const REASONS = ['Việc gia đình', 'Nghỉ ốm', 'Nghỉ phép năm', 'Đi học, tập huấn', 'Nghỉ lễ']

/** Thêm ngày nghỉ đột xuất của KTV hoặc ngày cả tiệm nghỉ (UC-02 1a, 1b, E1; TC-04). */
export function DayOffFormDialog({
  open,
  onOpenChange,
  staff,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: StaffMemberDto[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open && <DayOffForm staff={staff} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function DayOffForm({ staff, onClose }: { staff: StaffMemberDto[]; onClose: () => void }) {
  const create = useCreateDayOff()
  const today = vnToday()
  const technicians = staff.filter((s) => s.kind === 'KyThuatVien' && s.isActive)
  const [who, setWho] = useState(technicians[0]?.id ?? '')
  const [date, setDate] = useState(addDaysKey(today, 1))
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [affected, setAffected] = useState<AffectedAppointment[]>([])

  const resetFeedback = () => {
    setErrors({})
    setAffected([])
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!who) found.staffMemberId = 'Chọn kỹ thuật viên hoặc Cả tiệm nghỉ'
    if (!date) found.date = 'Chọn ngày nghỉ'
    else if (date < today) found.date = 'Không đăng ký ngày nghỉ đã qua'
    if (!reason.trim()) found.reason = 'Nhập lý do'
    setErrors(found)
    setAffected([])
    if (Object.keys(found).length) return

    create.mutate(
      { staffMemberId: who === WHOLE_SHOP ? null : who, date, reason: reason.trim() },
      {
        onSuccess: (saved: DayOffDto) => {
          toast.success(
            saved.staffMemberId
              ? `Đã thêm ngày nghỉ ${ddmmyyyy(saved.date)} cho ${saved.staffName}`
              : `Tiệm nghỉ ngày ${ddmmyyyy(saved.date)}`
          )
          onClose()
        },
        onError: (err) => {
          // UC-02 E1: trùng lịch hẹn đã có → liệt kê, không lưu; giữ nguyên dữ liệu đã nhập
          const list = problemAffected(err)
          if (list.length) {
            setAffected(list)
            return
          }
          const fields = getFieldErrors(err)
          if (Object.keys(fields).length) setErrors(fields)
          else toast.error(getErrorMessage(err))
        },
      }
    )
  }

  const saving = create.isPending

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
      <DialogHeader className="border-b px-6 py-4">
        <DialogTitle>Thêm ngày nghỉ</DialogTitle>
        <DialogDescription>
          Ngày đã có lịch hẹn thì phải chuyển kỹ thuật viên hoặc hủy các lịch đó trước khi lưu.
        </DialogDescription>
      </DialogHeader>

      <div className="grid max-h-[calc(100dvh-13rem)] gap-4 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
          <FormField
            label="Nhân viên nghỉ"
            required
            error={errors.staffMemberId}
            htmlFor="dayoff-staff"
          >
            <Select
              value={who}
              disabled={saving}
              onValueChange={(v) => {
                setWho(v)
                resetFeedback()
              }}
            >
              <SelectTrigger
                id="dayoff-staff"
                aria-invalid={errors.staffMemberId ? true : undefined}
              >
                <SelectValue placeholder="Chọn kỹ thuật viên" />
              </SelectTrigger>
              <SelectContent>
                {technicians.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Kỹ thuật viên</SelectLabel>
                    {technicians.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: t.color }}
                          aria-hidden="true"
                        />
                        {t.fullName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                <SelectGroup>
                  <SelectLabel>Cả tiệm</SelectLabel>
                  <SelectItem value={WHOLE_SHOP}>Cả tiệm nghỉ (lễ, Tết, bảo trì)</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Ngày" required error={errors.date}>
            <Input
              type="date"
              min={today}
              value={date}
              disabled={saving}
              onChange={(e) => {
                setDate(e.target.value)
                resetFeedback()
              }}
            />
          </FormField>
        </div>

        <FormField label="Lý do" required error={errors.reason}>
          <Input
            autoComplete="off"
            maxLength={200}
            value={reason}
            placeholder="vd: Việc gia đình"
            disabled={saving}
            onChange={(e) => {
              setReason(e.target.value)
              setErrors((x) => ({ ...x, reason: '' }))
            }}
          />
        </FormField>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              disabled={saving}
              onClick={() => {
                setReason(r)
                setErrors((x) => ({ ...x, reason: '' }))
              }}
              className="hover:border-primary hover:text-foreground text-muted-foreground focus-visible:ring-ring/50 cursor-pointer rounded-full border px-2.5 py-0.5 text-xs outline-none focus-visible:ring-3"
            >
              {r}
            </button>
          ))}
        </div>

        <AffectedList items={affected} />
      </div>

      <DialogFooter className="border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          Lưu ngày nghỉ
        </Button>
      </DialogFooter>
    </form>
  )
}
