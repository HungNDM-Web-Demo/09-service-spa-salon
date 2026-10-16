import { ApiError } from '@/lib/api-error'
import type { AffectedAppointment } from '@/types/spa'
import type { DraftCheck } from '../lib/schedule'
import { vnIso } from '../lib/vn-time'

/** Lỗi nghiệp vụ có `code` giống BE (07 §2.2). */

export const errorCodes = {
  lichKhongHopLe: 'LichKhongHopLe',
  gioDaCoNguoiDat: 'GioDaCoNguoiDat',
  trungLichKhach: 'TrungLichKhach',
  quaSoLichCho: 'QuaSoLichCho',
  tamKhoaTraCuu: 'TamKhoaTraCuu',
  lichBiAnhHuong: 'LichBiAnhHuong',
  daPhatSinh: 'DaPhatSinh',
  trangThaiKhongHopLe: 'TrangThaiKhongHopLe',
  tongTienDaDoi: 'TongTienDaDoi',
  thangDaChot: 'ThangDaChot',
  goiDaDung: 'GoiDaDung',
  chuaHetThang: 'ChuaHetThang',
} as const

/** 400 vi phạm nghiệp vụ (DomainException) */
export const domainError = (code: string, detail: string, extra: Record<string, unknown> = {}) =>
  ApiError.fromStatus(400, detail, { code, ...extra })

/** 409 có `code`; `field` thì kèm errors để gắn vào ô nhập */
export const conflictError = (code: string | null, detail: string, field?: string, extra: Record<string, unknown> = {}) =>
  ApiError.fromStatus(409, detail, {
    ...(code ? { code } : {}),
    ...(field ? { errors: { [field]: [detail] } } : {}),
    ...extra,
  })

/** 400 lỗi theo trường; một lỗi thì detail là chính câu đó (giống BE) */
export function fieldErrors(errors: Record<string, string>): ApiError {
  const entries = Object.entries(errors)
  return ApiError.fromStatus(400, entries.length === 1 ? entries[0][1] : 'Dữ liệu chưa hợp lệ.', {
    errors: Object.fromEntries(entries.map(([k, v]) => [k, [v]])),
  })
}

export const invalidState = (detail: string) => conflictError(errorCodes.trangThaiKhongHopLe, detail)
export const inUse = (detail: string) => conflictError(errorCodes.daPhatSinh, detail)
export const notFoundError = (detail: string, code?: string) => ApiError.fromStatus(404, detail, code ? { code } : {})

export function affectedError(affected: AffectedAppointment[], detail?: string): ApiError {
  return conflictError(
    errorCodes.lichBiAnhHuong,
    detail ?? `Có ${affected.length} lịch hẹn bị ảnh hưởng. Chuyển kỹ thuật viên hoặc hủy các lịch này trước.`,
    undefined,
    { affected }
  )
}

/** 400 LichKhongHopLe kèm từng dòng (07 §2.2) */
export function scheduleError(check: DraftCheck, date: string): ApiError {
  return domainError(errorCodes.lichKhongHopLe, check.first?.message ?? 'Lịch hẹn không hợp lệ', {
    issues: check.issues,
    lines: check.lines.map((l) => ({
      index: l.index,
      startAt: vnIso(date, l.start),
      endAt: vnIso(date, l.end),
      blockEndAt: vnIso(date, l.blockEnd),
      issues: l.issues,
    })),
  })
}

export const tooManyRequests = (detail: string, retryAfterSeconds: number) =>
  ApiError.fromStatus(429, detail, { code: errorCodes.tamKhoaTraCuu, retryAfterSeconds })
