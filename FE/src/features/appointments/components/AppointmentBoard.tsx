'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Clock, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppointmentCardDto, AppointmentLineDto, BoardDto, BoardTechnician } from '@/types/spa'
import { bookingRules, floor15 } from '@/features/booking/lib/rules'
import { hhmm, vnMinutesOfDay, vnNow } from '@/features/booking/lib/vn-time'

/** Lưới lịch hẹn theo kỹ thuật viên (SCR-02): mỗi hàng 15 phút, mỗi cột một KTV có ca trong ngày. */

const SLOT_H = 22
const COL_W = 156
const TIME_W = 56
const DRAG_THRESHOLD = 6

export type BoardMove = { appointment: AppointmentCardDto; line: AppointmentLineDto; staffId: string; start: number }

type AppointmentBoardProps = {
  board: BoardDto
  isToday: boolean
  /** Ngày đã qua: không tạo, không kéo */
  isPast: boolean
  canCreate: boolean
  canMove: boolean
  /** Làm mờ khối không phải "Chờ xác nhận" (?pending=1) */
  highlightPending: boolean
  onSlotClick: (staffId: string, start: number) => void
  onOpen: (appointment: AppointmentCardDto) => void
  onMove: (move: BoardMove) => void
}

type DragState = {
  appointment: AppointmentCardDto
  line: AppointmentLineDto
  pointerId: number
  startX: number
  startY: number
  offsetY: number
  originCol: number
  originStart: number
  active: boolean
  col: number
  start: number
}

const stripes = (color: string) =>
  `repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, ${color} 18%, transparent) 6px 8px)`

export function AppointmentBoard({
  board,
  isToday,
  isPast,
  canCreate,
  canMove,
  highlightPending,
  onSlotClick,
  onOpen,
  onMove,
}: AppointmentBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // Trạng thái kéo giữ trong ref để pointerup đọc đúng ngay cả khi nhấn-thả rất nhanh; state chỉ để vẽ bóng khối
  const dragRef = useRef<DragState | null>(null)
  const suppressClick = useRef(false)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [now, setNow] = useState(() => vnNow())

  const { openMinute: open, closeMinute: close, technicians } = board
  const slots = Math.max(1, Math.ceil((close - open) / bookingRules.slotStep))
  const height = slots * SLOT_H
  const nowIso = new Date(now).toISOString()
  const nowMinute = vnMinutesOfDay(now)
  const minCreate = isToday ? floor15(nowMinute) : isPast ? Infinity : -Infinity
  const colIndex = useMemo(() => new Map(technicians.map((t, i) => [t.id, i])), [technicians])
  const y = (minute: number) => ((minute - open) / bookingRules.slotStep) * SLOT_H

  // Vạch giờ hiện tại chạy theo phút
  useEffect(() => {
    if (!isToday) return
    const timer = window.setInterval(() => setNow(vnNow()), 60_000)
    return () => window.clearInterval(timer)
  }, [isToday])

  // Mở lưới hôm nay thì cuộn tới giờ hiện tại (UC-03 bước 1)
  const scrolledFor = useRef<string | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || scrolledFor.current === board.date) return
    scrolledFor.current = board.date
    const target = isToday ? y(vnMinutesOfDay(vnNow())) - SLOT_H * 4 : 0
    el.scrollTop = Math.max(0, target)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cuộn một lần mỗi ngày được xem
  }, [board.date, isToday])

  const movable = (a: AppointmentCardDto, l: AppointmentLineDto) =>
    canMove && !isPast && (a.status === 'ChoXacNhan' || a.status === 'DaXacNhan' || (a.status === 'DangPhucVu' && l.startAt > nowIso))

  const pointToCell = (clientX: number, clientY: number, offsetY: number) => {
    const rect = gridRef.current!.getBoundingClientRect()
    const colW = rect.width / Math.max(1, technicians.length)
    const col = Math.min(technicians.length - 1, Math.max(0, Math.floor((clientX - rect.left) / colW)))
    const raw = open + Math.round((clientY - rect.top - offsetY) / SLOT_H) * bookingRules.slotStep
    const start = Math.min(close - bookingRules.slotStep, Math.max(open, raw))
    return { col, start }
  }

  const onBlockPointerDown = (e: React.PointerEvent, a: AppointmentCardDto, l: AppointmentLineDto) => {
    if (e.button !== 0 || !movable(a, l)) return
    const blockTop = (e.currentTarget as HTMLElement).getBoundingClientRect().top
    const start = vnMinutesOfDay(l.startAt)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      appointment: a,
      line: l,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetY: e.clientY - blockTop,
      originCol: colIndex.get(l.staffMemberId) ?? 0,
      originStart: start,
      active: false,
      col: colIndex.get(l.staffMemberId) ?? 0,
      start,
    }
  }

  const onBlockPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    const moved = Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY)
    if (!d.active && moved < DRAG_THRESHOLD) return
    const cell = pointToCell(e.clientX, e.clientY, d.offsetY)
    if (d.active && cell.col === d.col && cell.start === d.start) return
    const next = { ...d, active: true, ...cell }
    dragRef.current = next
    setDrag(next)
  }

  const endDrag = () => {
    dragRef.current = null
    setDrag(null)
  }

  const onBlockPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    endDrag()
    if (!d.active) return
    // Vừa kéo xong: bỏ qua sự kiện click đi kèm để không mở chi tiết
    suppressClick.current = true
    if (d.col === d.originCol && d.start === d.originStart) return
    onMove({ appointment: d.appointment, line: d.line, staffId: technicians[d.col].id, start: d.start })
  }

  const onBlockClick = (e: React.MouseEvent, a: AppointmentCardDto) => {
    e.stopPropagation()
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    onOpen(a)
  }

  const onColumnClick = (e: React.MouseEvent, tech: BoardTechnician) => {
    if (!canCreate || isPast) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const minute = open + Math.floor((e.clientY - rect.top) / SLOT_H) * bookingRules.slotStep
    if (minute < minCreate) return
    onSlotClick(tech.id, minute)
  }

  const hours: number[] = []
  for (let m = Math.ceil(open / 60) * 60; m < close; m += 60) hours.push(m)

  return (
    <div
      ref={scrollRef}
      className="bg-card relative overflow-auto rounded-xl border shadow-xs"
      style={{ maxHeight: 'calc(100svh - 15rem)', minHeight: 360 }}
    >
      <div style={{ minWidth: TIME_W + technicians.length * COL_W }}>
        {/* Đầu cột: KTV, ca */}
        <div className="bg-card sticky top-0 z-30 flex border-b">
          <div className="bg-card sticky left-0 z-40 shrink-0 border-r" style={{ width: TIME_W }} />
          {technicians.map((t) => (
            <div key={t.id} className="flex min-w-0 flex-1 items-center gap-2 border-r px-2 py-2 last:border-r-0" style={{ minWidth: COL_W }}>
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.fullName}</p>
                <p className="text-muted-foreground truncate text-xs tabular-nums">
                  {t.offReason ?? (t.shiftStart !== null && t.shiftEnd !== null ? `${hhmm(t.shiftStart)}–${hhmm(t.shiftEnd)}` : '')}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex">
          {/* Cột giờ */}
          <div className="bg-card sticky left-0 z-20 shrink-0 border-r" style={{ width: TIME_W, height }}>
            {hours.map((m) => (
              <span
                key={m}
                className="text-muted-foreground absolute right-2 -translate-y-1/2 text-xs tabular-nums first:translate-y-0"
                style={{ top: y(m) }}
              >
                {hhmm(m)}
              </span>
            ))}
          </div>

          <div ref={gridRef} className="relative flex flex-1" style={{ height }}>
            {technicians.map((t) => {
              const off = t.shiftStart === null || t.shiftEnd === null
              return (
                <div
                  key={t.id}
                  role={canCreate && !isPast ? 'button' : undefined}
                  aria-label={canCreate && !isPast ? `Tạo lịch cho ${t.fullName}` : undefined}
                  tabIndex={-1}
                  onClick={(e) => onColumnClick(e, t)}
                  className={cn('relative min-w-0 flex-1 border-r last:border-r-0', canCreate && !isPast && 'cursor-cell')}
                  style={{
                    minWidth: COL_W,
                    backgroundImage: `linear-gradient(to bottom, var(--border) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 45%, transparent) 1px, transparent 1px)`,
                    backgroundSize: `100% ${SLOT_H * 4}px, 100% ${SLOT_H}px`,
                    backgroundPositionY: `${y(Math.ceil(open / 60) * 60)}px, 0`,
                  }}
                >
                  {off ? (
                    <div className="absolute inset-0" style={{ backgroundImage: stripes('var(--muted-foreground)') }} />
                  ) : (
                    <>
                      {t.shiftStart! > open && (
                        <div className="absolute inset-x-0 top-0" style={{ height: y(t.shiftStart!), backgroundImage: stripes('var(--muted-foreground)') }} />
                      )}
                      {t.shiftEnd! < close && (
                        <div
                          className="absolute inset-x-0 bottom-0"
                          style={{ top: y(t.shiftEnd!), backgroundImage: stripes('var(--muted-foreground)') }}
                        />
                      )}
                    </>
                  )}
                  {isToday && nowMinute > open && (
                    <div className="bg-muted/40 pointer-events-none absolute inset-x-0 top-0" style={{ height: Math.min(height, y(nowMinute)) }} />
                  )}
                </div>
              )
            })}

            {/* Khối lịch hẹn */}
            {board.appointments.flatMap((a) =>
              a.lines.map((l) => {
                const col = colIndex.get(l.staffMemberId)
                if (col === undefined) return null
                const start = vnMinutesOfDay(l.startAt)
                const end = start + l.durationMinutes
                const dragging = drag?.active && drag.line.id === l.id
                return (
                  <Block
                    key={l.id}
                    appointment={a}
                    line={l}
                    top={y(start)}
                    height={((end - start) / bookingRules.slotStep) * SLOT_H}
                    cleanup={(l.cleanupMinutes / bookingRules.slotStep) * SLOT_H}
                    left={`calc(${(col / technicians.length) * 100}% + 3px)`}
                    width={`calc(${100 / technicians.length}% - 6px)`}
                    dimmed={(highlightPending && a.status !== 'ChoXacNhan') || !!dragging}
                    draggable={movable(a, l)}
                    onPointerDown={(e) => onBlockPointerDown(e, a, l)}
                    onPointerMove={onBlockPointerMove}
                    onPointerUp={onBlockPointerUp}
                    onPointerCancel={endDrag}
                    onClick={(e) => onBlockClick(e, a)}
                    onKeyOpen={() => onOpen(a)}
                  />
                )
              })
            )}

            {/* Bóng khối khi kéo */}
            {drag?.active && (
              <div
                className="border-primary bg-primary/10 pointer-events-none absolute z-20 rounded-md border-2 border-dashed px-2 py-1 text-xs font-medium"
                style={{
                  top: y(drag.start),
                  height: (drag.line.durationMinutes / bookingRules.slotStep) * SLOT_H,
                  left: `calc(${(drag.col / technicians.length) * 100}% + 3px)`,
                  width: `calc(${100 / technicians.length}% - 6px)`,
                }}
              >
                <span className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 tabular-nums">
                  {hhmm(drag.start)} · {technicians[drag.col]?.fullName}
                </span>
              </div>
            )}

            {/* Vạch giờ hiện tại */}
            {isToday && nowMinute >= open && nowMinute <= close && (
              <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: y(nowMinute) }}>
                <div className="bg-destructive h-0.5 w-full" />
                <span className="bg-destructive text-destructive-foreground absolute -top-2.5 left-1 rounded px-1 text-[0.6875rem] font-medium tabular-nums">
                  {hhmm(nowMinute)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type BlockProps = {
  appointment: AppointmentCardDto
  line: AppointmentLineDto
  top: number
  height: number
  cleanup: number
  left: string
  width: string
  dimmed: boolean
  draggable: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: () => void
  onClick: (e: React.MouseEvent) => void
  onKeyOpen: () => void
}

function Block({
  appointment: a,
  line: l,
  top,
  height,
  cleanup,
  left,
  width,
  dimmed,
  draggable,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
  onKeyOpen,
}: BlockProps) {
  const pending = a.status === 'ChoXacNhan'
  const tone = pending
    ? a.pendingOverdue
      ? 'border-2 border-dashed border-cta bg-[color-mix(in_oklab,var(--cta)_26%,var(--card))]'
      : 'border-2 border-dashed border-pending bg-[color-mix(in_oklab,var(--pending)_16%,var(--card))]'
    : a.status === 'DangPhucVu'
      ? 'border border-success/60 bg-[color-mix(in_oklab,var(--success)_16%,var(--card))]'
      : a.status === 'HoanThanh'
        ? 'border border-border bg-muted text-muted-foreground'
        : 'border border-border bg-card'
  const compact = height < 50

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${a.code} ${a.customerName} ${l.serviceName} ${hhmm(vnMinutesOfDay(l.startAt))}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onKeyOpen()
          }
        }}
        className={cn(
          'absolute z-10 overflow-hidden rounded-md px-2 py-1 text-xs shadow-xs transition-opacity select-none',
          'focus-visible:ring-ring/60 outline-none focus-visible:ring-3',
          draggable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
          tone,
          dimmed && 'opacity-35'
        )}
        style={{
          top,
          height: Math.max(height - 1, 18),
          left,
          width,
          borderLeft: a.status === 'DaXacNhan' || a.status === 'DangPhucVu' ? `4px solid ${l.staffColor}` : undefined,
        }}
      >
        <div className="flex items-center gap-1">
          <span className="font-semibold tabular-nums">
            {hhmm(vnMinutesOfDay(l.startAt))}–{hhmm(vnMinutesOfDay(l.endAt))}
          </span>
          {a.source === 'Online' && <Globe className="size-3 shrink-0 opacity-70" aria-label="Đặt online" />}
          {a.isLate && (
            <span className="bg-destructive text-destructive-foreground ml-auto rounded px-1 text-[0.625rem] font-semibold">Trễ</span>
          )}
          {!a.isLate && pending && (
            <Clock className={cn('ml-auto size-3 shrink-0', a.pendingOverdue ? 'text-cta' : 'text-pending')} aria-label="Chờ xác nhận" />
          )}
        </div>
        <p className="flex items-center gap-1 truncate font-medium">
          {a.isFlagged && <AlertTriangle className="text-warning size-3 shrink-0" aria-label="Hay bỏ hẹn" />}
          <span className="truncate">{a.customerName}</span>
        </p>
        {!compact && <p className="truncate opacity-80">{l.serviceName}</p>}
      </div>
      {cleanup > 0 && (
        <div
          aria-hidden="true"
          className={cn('pointer-events-none absolute z-0 rounded-b-md', dimmed && 'opacity-35')}
          style={{ top: top + height, height: cleanup, left, width, backgroundImage: stripes(l.staffColor) }}
        />
      )}
    </>
  )
}
