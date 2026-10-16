import type { Gender, MessageKind } from '@/types/spa'
import { ddmmyyyy, hhmm } from './vn-time'

/** Nội dung tin nhắn giả lập (FR-17, 07 §3.10). BE `BookingMessages.cs` cùng mẫu câu. */

/** "chị Lan Anh", "anh Huy", "quý khách" */
export function salutation(fullName: string, gender: Gender | null): string {
  const parts = fullName.split(' ').filter(Boolean)
  let short = parts.length >= 2 ? `${parts[parts.length - 2]} ${parts[parts.length - 1]}` : fullName
  if (parts.length >= 3 && gender === 'Nam') short = parts[parts.length - 1]
  if (gender === 'Nu') return `chị ${short}`
  if (gender === 'Nam') return `anh ${short}`
  return 'quý khách'
}

export function buildMessage(
  kind: MessageKind,
  storeName: string,
  code: string,
  date: string,
  startMinute: number,
  services: string,
  customerName: string,
  gender: Gender | null,
  reason?: string | null
): string {
  switch (kind) {
    case 'XacNhan':
      return `${storeName} xác nhận lịch ${code} lúc ${hhmm(startMinute)} ngày ${ddmmyyyy(date)}: ${services}. Hẹn gặp ${salutation(customerName, gender)}!`
    case 'DoiLich':
      return `Lịch ${code} đã đổi sang ${hhmm(startMinute)} ngày ${ddmmyyyy(date)}: ${services}.`
    case 'Huy':
      return `Lịch ${code} lúc ${hhmm(startMinute)} ngày ${ddmmyyyy(date)} đã hủy. Lý do: ${reason}.`
    default:
      return `Nhắc lịch: ${salutation(customerName, gender)} có hẹn lúc ${hhmm(startMinute)} hôm nay tại ${storeName}: ${services}.`
  }
}
