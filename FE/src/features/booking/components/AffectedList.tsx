import Link from 'next/link'
import { routePath } from '@/config/route-path'
import type { AffectedAppointment } from '@/types/spa'
import { ddmmyyyy, vnHhmm } from '../lib/vn-time'
import { AppointmentStatusBadge } from './SpaBadges'

/**
 * Danh sách lịch hẹn bị ảnh hưởng khi đổi ca, thêm ngày nghỉ, bỏ dịch vụ làm được, đổi giờ mở cửa
 * (409 LichBiAnhHuong, UC-02 E1). Bấm mã để mở lịch, chuyển KTV hoặc hủy.
 */
export function AffectedList({ items }: { items: AffectedAppointment[] }) {
  if (items.length === 0) return null
  return (
    <div className="border-warning/40 bg-warning/5 rounded-lg border">
      <p className="text-warning border-warning/30 border-b px-3 py-2 text-sm font-medium">
        {items.length} lịch hẹn bị ảnh hưởng, chuyển kỹ thuật viên hoặc hủy trước khi lưu
      </p>
      <ul className="max-h-56 divide-y overflow-y-auto text-sm">
        {items.map((a) => (
          <li key={`${a.appointmentId}-${a.startAt}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <Link
              href={routePath.appointmentDetail(a.appointmentId)}
              target="_blank"
              className="text-primary font-medium tabular-nums hover:underline"
            >
              {a.code}
            </Link>
            <span className="tabular-nums">
              {ddmmyyyy(a.date)} {vnHhmm(a.startAt)}–{vnHhmm(a.endAt)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {a.customerName} · {a.serviceName} · {a.staffName}
            </span>
            <AppointmentStatusBadge status={a.status} />
          </li>
        ))}
      </ul>
    </div>
  )
}
