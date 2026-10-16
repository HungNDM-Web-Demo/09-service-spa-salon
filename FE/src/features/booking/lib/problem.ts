import { isApiError } from '@/lib/api-error'
import type { AffectedAppointment, Issue, LineCheckDto } from '@/types/spa'

/** Đọc phần mở rộng của ProblemDetails nghiệp vụ (07 §2.2). */

export const problemCode = (error: unknown): string | null =>
  isApiError(error) && typeof error.problem.code === 'string' ? error.problem.code : null

/** Danh sách lịch bị ảnh hưởng của lỗi 409 LichBiAnhHuong */
export const problemAffected = (error: unknown): AffectedAppointment[] =>
  isApiError(error) && Array.isArray(error.problem.affected) ? (error.problem.affected as AffectedAppointment[]) : []

/** Lỗi từng dòng của 400 LichKhongHopLe */
export const problemLines = (error: unknown): LineCheckDto[] =>
  isApiError(error) && Array.isArray(error.problem.lines) ? (error.problem.lines as LineCheckDto[]) : []

export const problemIssues = (error: unknown): Issue[] =>
  isApiError(error) && Array.isArray(error.problem.issues) ? (error.problem.issues as Issue[]) : []

/** Tổng tiền máy chủ tính lại khi 409 TongTienDaDoi */
export const problemServerTotal = (error: unknown): number | null =>
  isApiError(error) && typeof error.problem.serverTotal === 'number' ? error.problem.serverTotal : null
