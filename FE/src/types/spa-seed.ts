/**
 * Hình dạng của src/mock/seed/demo-data.json (docs/06-THIET-KE-CSDL.md §5.2, §5.4).
 * BE đọc cùng file bằng `SpaSeedRecords.cs`.
 */
import type { AppointmentSource, AppointmentStatus, CommissionType, Gender, PaymentMethod, StaffKind } from './spa'

export type SeedDay = { w?: [number, number]; d?: number }

export type SpaSeedFile = {
  serviceGroups: { code: string; name: string; visible?: boolean }[]
  services: {
    code: string
    name: string
    group: string
    dur: number
    clean: number
    price: number
    ct: CommissionType
    cv: number
    online: boolean
    visible?: boolean
    desc?: string
    img?: string
  }[]
  packageTemplates: {
    code: string
    name: string
    service: string
    sessions: number
    price: number
    months: number
    gap: number
    rate: number
    active?: boolean
  }[]
  staff: {
    code: string
    name: string
    phone: string
    kind: StaffKind
    color: string
    specialty?: string
    user?: string
    services: string[]
    week: string
  }[]
  daysOff: (SeedDay & { staff?: string; reason: string })[]
  customers: { code: string; name: string; phone: string; g?: Gender; birth?: string; note?: string; cr: number }[]
  packageSales: (SeedDay & {
    id: string
    c: string
    tpl: string
    t: string
    by: string
    m: PaymentMethod
    exp?: number
    fx?: boolean
  })[]
  appointments: (SeedDay & {
    id: string
    c: string
    src: AppointmentSource
    o?: 'done' | 'noshow' | 'cancel' | 'pending'
    st?: AppointmentStatus
    ln: [string, string, string][]
    ld?: number
    cr?: number
    nt?: string
    cx?: string[]
    pay?: {
      m: PaymentMethod
      disc?: [string, number, string?]
      sell?: [string, string][]
      ovr?: string
      by?: string
    }
    fx?: boolean
  })[]
  reserve: { staff: string[]; d?: number; day?: string; from?: string }[]
}
