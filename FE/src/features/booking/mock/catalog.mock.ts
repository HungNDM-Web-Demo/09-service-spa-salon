import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission, requireSession } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { newId } from '@/mock/mock-helpers'
import { usersDb, rolesOfUser } from '@/mock/system-data'
import type {
  AccountCandidate,
  AffectedAppointment,
  BusinessHoursDto,
  CreateDayOffInput,
  DayOffDto,
  NextCodeDto,
  PackageTemplateDto,
  SavePackageTemplateInput,
  SaveServiceGroupInput,
  SaveServiceInput,
  SaveStaffMemberInput,
  ServiceDto,
  ServiceGroupDto,
  ServiceOption,
  ShiftType,
  StaffMemberDto,
  StaffOption,
  StoreProfileDto,
} from '@/types/spa'
import { bookingRules, digitsOnly, shiftWindow } from '../lib/rules'
import { validateService, validateStaff, validateTemplate } from '../lib/validation'
import { addDaysKey, hhmm, isoWeekdayOf, parseHhmm, vnLocal } from '../lib/vn-time'
import { affectedError, conflictError, fieldErrors, inUse, invalidState, notFoundError } from './errors'
import {
  activeTechnicians,
  dayOffDto,
  groupDto,
  serviceDto,
  serviceOption,
  sortServices,
  staffDto,
  technicianMap,
  templateDto,
} from './mappers'
import type { AppointmentRecord, LineRecord, ServiceRecord, StaffRecord, TemplateRecord } from './records'
import {
  appointmentsDb,
  customersDb,
  daysOffDb,
  ensureFresh,
  groupsDb,
  hours,
  hoursDb,
  invoicesDb,
  nextCatalogCode,
  nowIso,
  packagesDb,
  servicesDb,
  staffDb,
  store,
  templatesDb,
  today,
} from './store'

/** Handler mock nhóm dịch vụ, dịch vụ, gói mẫu, giờ mở cửa, nhân viên, ngày nghỉ (07 §4.1–4.3). */

async function begin(...codes: string[]) {
  await mockDelay()
  if (codes.length) requirePermission(...codes)
  else requireSession()
  ensureFresh()
}

// ───────────────────────────── Lịch bị ảnh hưởng (BR-27)

const WORKING = new Set(['ChoXacNhan', 'DaXacNhan', 'DangPhucVu'])

function affectedOf(predicate: (a: AppointmentRecord, l: LineRecord) => boolean): AffectedAppointment[] {
  return appointmentsDb
    .filter((a) => WORKING.has(a.status))
    .flatMap((a) => a.lines.filter((l) => predicate(a, l)).map((l) => ({ a, l })))
    .sort((x, y) => (x.l.startAt < y.l.startAt ? -1 : 1))
    .map(({ a, l }) => ({
      appointmentId: a.id,
      code: a.code,
      date: a.date,
      startAt: l.startAt,
      endAt: l.endAt,
      customerName: customersDb.get(a.customerId)?.fullName ?? '',
      serviceName: l.serviceName,
      staffName: staffDb.get(l.staffMemberId)?.fullName ?? '',
      status: a.status,
    }))
}

const future = (l: LineRecord) => l.startAt >= nowIso()

export const catalogMock = {
  // ── Nhóm dịch vụ
  async getGroups(): Promise<ServiceGroupDto[]> {
    await begin(permissions.services.view)
    return groupsDb
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => groupDto(g.id))
  },

  async createGroup(input: SaveServiceGroupInput): Promise<ServiceGroupDto> {
    await begin(permissions.services.create)
    const name = input.name?.trim()
    if (!name) throw fieldErrors({ name: 'Nhập tên nhóm' })
    if (groupsDb.some((g) => g.name === name)) throw conflictError(null, `Nhóm ${name} đã có.`, 'name')
    const max = groupsDb.all().reduce((m, g) => Math.max(m, g.sortOrder), 0)
    const group = groupsDb.insert({ id: newId(), name, isVisible: input.isVisible, sortOrder: max + 10, createdAt: nowIso() })
    auditCreate('ServiceGroup', group)
    return groupDto(group.id)
  },

  async updateGroup(id: string, input: SaveServiceGroupInput): Promise<ServiceGroupDto> {
    await begin(permissions.services.update)
    const before = groupsDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy nhóm dịch vụ.')
    const name = input.name?.trim()
    if (!name) throw fieldErrors({ name: 'Nhập tên nhóm' })
    if (groupsDb.some((g) => g.name === name && g.id !== id)) throw conflictError(null, `Nhóm ${name} đã có.`, 'name')
    const after = groupsDb.update(id, { name, isVisible: input.isVisible })!
    auditUpdate('ServiceGroup', before, after)
    return groupDto(id)
  },

  async reorderGroups(ids: string[]): Promise<void> {
    await begin(permissions.services.update)
    const order = [...ids, ...groupsDb.all().map((g) => g.id).filter((id) => !ids.includes(id))]
    mockDb.batch(() => groupsDb.all().forEach((g) => groupsDb.update(g.id, { sortOrder: (order.indexOf(g.id) + 1) * 10 })))
  },

  async deleteGroup(id: string): Promise<void> {
    await begin(permissions.services.delete)
    const group = groupsDb.get(id)
    if (!group) throw notFoundError('Không tìm thấy nhóm dịch vụ.')
    if (servicesDb.some((s) => s.groupId === id)) throw inUse('Nhóm còn dịch vụ, chuyển hoặc xóa các dịch vụ trước.')
    groupsDb.remove(id)
    auditDelete('ServiceGroup', group)
  },

  // ── Dịch vụ
  async getServices(query: { groupId?: string; visible?: boolean } = {}): Promise<ServiceDto[]> {
    await begin(permissions.services.view)
    const technicians = technicianMap()
    return sortServices(
      servicesDb.filter((s) => (!query.groupId || s.groupId === query.groupId) && (query.visible === undefined || s.isVisible === query.visible))
    ).map((s) => serviceDto(s, technicians))
  },

  async getServiceOptions(): Promise<ServiceOption[]> {
    await begin(permissions.appointments.view, permissions.appointments.create, permissions.customerPackages.sell, permissions.packages.view)
    const technicians = technicianMap()
    return sortServices(servicesDb.filter((s) => s.isVisible && groupsDb.get(s.groupId)?.isVisible !== false)).map((s) =>
      serviceOption(s, technicians)
    )
  },

  async nextServiceCode(): Promise<NextCodeDto> {
    await begin(permissions.services.create)
    return { code: nextCatalogCode(servicesDb.all().map((s) => s.code), 'DV', 3) }
  },

  async getService(id: string): Promise<ServiceDto> {
    await begin(permissions.services.view)
    const s = servicesDb.get(id)
    if (!s) throw notFoundError('Không tìm thấy dịch vụ.')
    return serviceDto(s)
  },

  async createService(input: SaveServiceInput): Promise<ServiceDto> {
    await begin(permissions.services.create)
    const errors = validateService(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const code = input.code.trim()
    if (servicesDb.some((s) => s.code === code)) throw conflictError(null, `Mã dịch vụ ${code} đã tồn tại.`, 'code')
    if (!groupsDb.get(input.groupId)) throw fieldErrors({ groupId: 'Chọn nhóm dịch vụ' })
    const service = servicesDb.insert({ id: newId(), ...normalizeService(input), createdAt: nowIso() })
    auditCreate('Service', service)
    return serviceDto(service)
  },

  async updateService(id: string, input: SaveServiceInput): Promise<ServiceDto> {
    await begin(permissions.services.update)
    const before = servicesDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy dịch vụ.')
    const errors = validateService(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const code = input.code.trim()
    if (servicesDb.some((s) => s.code === code && s.id !== id)) throw conflictError(null, `Mã dịch vụ ${code} đã tồn tại.`, 'code')
    const after = servicesDb.update(id, normalizeService(input))!
    auditUpdate('Service', before, after)
    return serviceDto(after)
  },

  async setServiceVisibility(id: string, isVisible: boolean): Promise<ServiceDto> {
    await begin(permissions.services.update)
    const before = servicesDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy dịch vụ.')
    const after = servicesDb.update(id, { isVisible })!
    auditUpdate('Service', before, after)
    return serviceDto(after)
  },

  async deleteService(id: string): Promise<void> {
    await begin(permissions.services.delete)
    const s = servicesDb.get(id)
    if (!s) throw notFoundError('Không tìm thấy dịch vụ.')
    const used =
      appointmentsDb.some((a) => a.lines.some((l) => l.serviceId === id)) ||
      invoicesDb.some((i) => i.lines.some((l) => l.serviceId === id))
    if (used) throw inUse('Dịch vụ đã có lịch hẹn, hóa đơn; hãy dùng Ẩn thay vì xóa.')
    if (templatesDb.some((t) => t.serviceId === id)) throw inUse('Dịch vụ đang có gói mẫu; hãy dùng Ẩn thay vì xóa.')
    mockDb.batch(() => {
      servicesDb.remove(id)
      for (const st of staffDb.filter((x) => x.serviceIds.includes(id)))
        staffDb.update(st.id, { serviceIds: st.serviceIds.filter((x) => x !== id) })
    })
    auditDelete('Service', s)
  },

  // ── Gói mẫu
  async getTemplates(): Promise<PackageTemplateDto[]> {
    await begin(permissions.packages.view)
    return templatesDb
      .all()
      .sort((a, b) => (a.code < b.code ? -1 : 1))
      .map(templateDto)
  },

  async getTemplateOptions(): Promise<PackageTemplateDto[]> {
    await begin(permissions.customerPackages.sell, permissions.packages.view)
    return templatesDb
      .filter((t) => t.isActive)
      .sort((a, b) => (a.code < b.code ? -1 : 1))
      .map(templateDto)
  },

  async nextTemplateCode(): Promise<NextCodeDto> {
    await begin(permissions.packages.create)
    return { code: nextCatalogCode(templatesDb.all().map((t) => t.code), 'GOI', 2) }
  },

  async createTemplate(input: SavePackageTemplateInput): Promise<PackageTemplateDto> {
    await begin(permissions.packages.create)
    const errors = validateTemplate(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const code = input.code.trim()
    if (templatesDb.some((t) => t.code === code)) throw conflictError(null, `Mã gói ${code} đã tồn tại.`, 'code')
    if (!servicesDb.get(input.serviceId)) throw fieldErrors({ serviceId: 'Chọn dịch vụ áp dụng' })
    const t = templatesDb.insert({ id: newId(), ...normalizeTemplate(input), createdAt: nowIso() })
    auditCreate('PackageTemplate', t)
    return templateDto(t)
  },

  async updateTemplate(id: string, input: SavePackageTemplateInput): Promise<PackageTemplateDto> {
    await begin(permissions.packages.update)
    const before = templatesDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy gói mẫu.')
    const errors = validateTemplate(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const code = input.code.trim()
    if (templatesDb.some((t) => t.code === code && t.id !== id)) throw conflictError(null, `Mã gói ${code} đã tồn tại.`, 'code')
    const after = templatesDb.update(id, normalizeTemplate(input))!
    auditUpdate('PackageTemplate', before, after)
    return templateDto(after)
  },

  async setTemplateActive(id: string, isActive: boolean): Promise<PackageTemplateDto> {
    await begin(permissions.packages.update)
    const before = templatesDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy gói mẫu.')
    const after = templatesDb.update(id, { isActive })!
    auditUpdate('PackageTemplate', before, after)
    return templateDto(after)
  },

  async deleteTemplate(id: string): Promise<void> {
    await begin(permissions.packages.delete)
    const t = templatesDb.get(id)
    if (!t) throw notFoundError('Không tìm thấy gói mẫu.')
    if (packagesDb.some((p) => p.packageTemplateId === id)) throw inUse('Gói mẫu đã bán cho khách; hãy dùng Ngừng bán thay vì xóa.')
    templatesDb.remove(id)
    auditDelete('PackageTemplate', t)
  },

  // ── Giờ mở cửa
  async getHours(): Promise<BusinessHoursDto> {
    await begin()
    const { open, close } = hours()
    return { openTime: hhmm(open), closeTime: hhmm(close) }
  },

  async getStoreProfile(): Promise<StoreProfileDto> {
    await begin()
    return store()
  },

  async updateHours(input: BusinessHoursDto): Promise<BusinessHoursDto> {
    await begin(permissions.staffMembers.update)
    const valid = (v: string) => /^\d{2}:\d{2}$/.test(v) && parseHhmm(v) % 15 === 0
    const errors: Record<string, string> = {}
    if (!valid(input.openTime)) errors.openTime = 'Giờ mở cửa dạng HH:mm, bước 15 phút'
    if (!valid(input.closeTime)) errors.closeTime = 'Giờ đóng cửa dạng HH:mm, bước 15 phút'
    else if (parseHhmm(input.closeTime) > 1380) errors.closeTime = 'Giờ đóng cửa muộn nhất 23:00'
    else if (valid(input.openTime) && parseHhmm(input.closeTime) - parseHhmm(input.openTime) < 240)
      errors.closeTime = 'Tiệm mở cửa tối thiểu 4 giờ mỗi ngày'
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const open = parseHhmm(input.openTime)
    const close = parseHhmm(input.closeTime)
    const affected = affectedOf((_, l) => {
      if (!future(l)) return false
      const start = vnLocal(l.startAt).minute
      return start < open || start + l.durationMinutes > close
    })
    if (affected.length) throw affectedError(affected)
    hoursDb.update('hours', { openMinute: open, closeMinute: close })
    return { openTime: hhmm(open), closeTime: hhmm(close) }
  },

  // ── Nhân viên
  async getStaff(): Promise<StaffMemberDto[]> {
    await begin(permissions.staffMembers.view)
    return staffDb
      .all()
      .sort((a, b) => kindOrder(a) - kindOrder(b) || a.sortOrder - b.sortOrder || (a.code < b.code ? -1 : 1))
      .map(staffDto)
  },

  async getStaffOptions(): Promise<StaffOption[]> {
    await begin()
    return staffDb
      .filter((s) => s.isActive)
      .sort((a, b) => kindOrder(a) - kindOrder(b) || a.sortOrder - b.sortOrder || (a.code < b.code ? -1 : 1))
      .map((s) => ({ id: s.id, code: s.code, fullName: s.fullName, kind: s.kind, color: s.color }))
  },

  async getAccountCandidates(): Promise<AccountCandidate[]> {
    await begin(permissions.staffMembers.update, permissions.staffMembers.create)
    return usersDb
      .filter((u) => !u.isDeleted && u.isActive)
      .sort((a, b) => (a.username < b.username ? -1 : 1))
      .map((u) => {
        const linked = staffDb.find((s) => s.userId === u.id)
        return {
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          roles: rolesOfUser(u).map((r) => r.code),
          linkedStaffId: linked?.id ?? null,
          linkedStaffName: linked?.fullName ?? null,
        }
      })
  },

  async nextStaffCode(): Promise<NextCodeDto> {
    await begin(permissions.staffMembers.create)
    return { code: nextCatalogCode(staffDb.all().map((s) => s.code), 'NV', 2) }
  },

  async createStaff(input: SaveStaffMemberInput): Promise<StaffMemberDto> {
    await begin(permissions.staffMembers.create)
    const errors = validateStaff(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const code = input.code.trim()
    if (staffDb.some((s) => s.code === code)) throw conflictError(null, `Mã nhân viên ${code} đã tồn tại.`, 'code')
    ensureAccount(input.userId ?? null, null)
    const technician = input.kind === 'KyThuatVien'
    const member = staffDb.insert({
      id: newId(),
      code,
      ...normalizeStaff(input),
      isActive: true,
      sortOrder: staffDb.all().reduce((m, s) => Math.max(m, s.sortOrder), 0) + 10,
      serviceIds: technician ? [...new Set(input.serviceIds)] : [],
      shifts: technician ? (input.shifts?.length === 7 ? input.shifts : Array<ShiftType>(7).fill('CaNgay')) : [],
      createdAt: nowIso(),
    })
    auditCreate('StaffMember', member)
    return staffDto(member)
  },

  async updateStaff(id: string, input: SaveStaffMemberInput): Promise<StaffMemberDto> {
    await begin(permissions.staffMembers.update)
    const before = staffDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy nhân viên.')
    const errors = validateStaff(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const code = input.code.trim()
    if (staffDb.some((s) => s.code === code && s.id !== id)) throw conflictError(null, `Mã nhân viên ${code} đã tồn tại.`, 'code')
    ensureAccount(input.userId ?? null, id)
    const technician = input.kind === 'KyThuatVien'
    const services = technician ? [...new Set(input.serviceIds)] : []
    const removed = before.serviceIds.filter((sid) => !services.includes(sid))
    if (removed.length) {
      const affected = affectedOf((_, l) => future(l) && l.staffMemberId === id && removed.includes(l.serviceId))
      if (affected.length) throw affectedError(affected)
    }
    const shifts = technician
      ? input.shifts?.length === 7
        ? input.shifts
        : before.shifts.length === 7
          ? before.shifts
          : Array<ShiftType>(7).fill('CaNgay')
      : []
    if (technician && input.shifts?.length === 7) ensureShiftsFit(id, input.shifts)
    const after = staffDb.update(id, { code, ...normalizeStaff(input), serviceIds: services, shifts })!
    auditUpdate('StaffMember', before, after)
    return staffDto(after)
  },

  async updateShifts(id: string, shifts: ShiftType[]): Promise<StaffMemberDto> {
    await begin(permissions.staffMembers.update)
    const before = staffDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy nhân viên.')
    if (before.kind !== 'KyThuatVien') throw invalidState('Chỉ kỹ thuật viên có lịch làm việc theo ca.')
    if (shifts.length !== 7) throw fieldErrors({ shifts: 'Lịch tuần gồm 7 ngày' })
    ensureShiftsFit(id, shifts)
    const after = staffDb.update(id, { shifts })!
    auditUpdate('StaffMember', before, after)
    return staffDto(after)
  },

  async setStaffActive(id: string, isActive: boolean): Promise<StaffMemberDto> {
    await begin(permissions.staffMembers.update)
    const before = staffDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy nhân viên.')
    if (!isActive && before.isActive) {
      const affected = affectedOf((_, l) => future(l) && l.staffMemberId === id)
      if (affected.length)
        throw affectedError(
          affected,
          `${before.fullName} còn ${affected.length} lịch hẹn sắp tới, chuyển kỹ thuật viên hoặc hủy các lịch này trước.`
        )
    }
    const after = staffDb.update(id, { isActive })!
    auditUpdate('StaffMember', before, after)
    return staffDto(after)
  },

  async deleteStaff(id: string): Promise<void> {
    await begin(permissions.staffMembers.delete)
    const s = staffDb.get(id)
    if (!s) throw notFoundError('Không tìm thấy nhân viên.')
    const used =
      appointmentsDb.some((a) => a.lines.some((l) => l.staffMemberId === id)) ||
      invoicesDb.some((i) => i.lines.some((l) => l.staffMemberId === id)) ||
      packagesDb.some((p) => p.consultantStaffId === id)
    if (used) throw inUse('Nhân viên đã có lịch hẹn, hoa hồng; hãy chuyển sang Nghỉ việc thay vì xóa.')
    mockDb.batch(() => {
      staffDb.remove(id)
      daysOffDb.removeWhere((d) => d.staffMemberId === id)
    })
    auditDelete('StaffMember', s)
  },

  // ── Ngày nghỉ
  async getDaysOff(query: { from?: string; to?: string } = {}): Promise<DayOffDto[]> {
    await begin(permissions.staffMembers.view)
    const from = query.from || addDaysKey(today(), -30)
    const to = query.to || addDaysKey(today(), 90)
    return daysOffDb
      .filter((d) => d.date >= from && d.date <= to)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map(dayOffDto)
  },

  async createDayOff(input: CreateDayOffInput): Promise<DayOffDto> {
    await begin(permissions.staffMembers.update)
    const errors: Record<string, string> = {}
    if (!input.date) errors.date = 'Chọn ngày nghỉ'
    if (!input.reason?.trim()) errors.reason = 'Nhập lý do'
    if (Object.keys(errors).length) throw fieldErrors(errors)
    if (input.date < today()) throw fieldErrors({ date: 'Không đăng ký ngày nghỉ đã qua' })
    const staffId = input.staffMemberId || null
    const member = staffId ? staffDb.get(staffId) : null
    if (staffId && !member) throw fieldErrors({ staffMemberId: 'Chọn kỹ thuật viên' })
    if (daysOffDb.some((d) => d.date === input.date && d.staffMemberId === staffId))
      throw conflictError(null, staffId ? `${member!.fullName} đã có ngày nghỉ này.` : 'Ngày này đã là ngày tiệm nghỉ.', 'date')
    const affected = affectedOf((a, l) => a.date === input.date && (!staffId || l.staffMemberId === staffId))
    if (affected.length) throw affectedError(affected)
    const record = daysOffDb.insert({ id: newId(), staffMemberId: staffId, date: input.date, reason: input.reason.trim(), createdAt: nowIso() })
    auditCreate('DayOff', record)
    return dayOffDto(record)
  },

  async deleteDayOff(id: string): Promise<void> {
    await begin(permissions.staffMembers.update)
    const d = daysOffDb.get(id)
    if (!d) throw notFoundError('Không tìm thấy ngày nghỉ.')
    daysOffDb.remove(id)
    auditDelete('DayOff', d)
  },
}

const kindOrder = (s: StaffRecord) => (s.kind === 'KyThuatVien' ? 0 : 1)

function normalizeService(input: SaveServiceInput): Omit<ServiceRecord, 'id' | 'createdAt'> {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    groupId: input.groupId,
    durationMinutes: input.durationMinutes,
    cleanupMinutes: input.cleanupMinutes,
    price: input.price,
    description: input.description?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    allowOnline: input.allowOnline,
    commissionType: input.commissionType,
    commissionValue: input.commissionValue,
    isVisible: input.isVisible,
  }
}

function normalizeTemplate(input: SavePackageTemplateInput): Omit<TemplateRecord, 'id' | 'createdAt'> {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    serviceId: input.serviceId,
    sessions: input.sessions,
    price: input.price,
    validityMonths: input.validityMonths,
    minIntervalDays: input.minIntervalDays,
    commissionRate: input.commissionRate,
    isActive: input.isActive,
  }
}

function normalizeStaff(input: SaveStaffMemberInput) {
  return {
    fullName: input.fullName.trim(),
    phone: digitsOnly(input.phone),
    kind: input.kind,
    color: input.color.toUpperCase(),
    specialty: input.specialty?.trim() || null,
    userId: input.userId || null,
  }
}

function ensureAccount(userId: string | null, selfId: string | null) {
  if (!userId) return
  if (!usersDb.get(userId)) throw fieldErrors({ userId: 'Tài khoản không tồn tại' })
  const other = staffDb.find((s) => s.userId === userId && s.id !== selfId)
  if (other) throw conflictError(null, `Tài khoản đã liên kết với ${other.fullName}.`, 'userId')
}

/** BR-27: đổi ca mà lịch đã có rơi ra ngoài ca mới */
function ensureShiftsFit(staffId: string, shifts: ShiftType[]) {
  const { open, close } = hours()
  const affected = affectedOf((_, l) => {
    if (!future(l) || l.staffMemberId !== staffId) return false
    const local = vnLocal(l.startAt)
    const w = shiftWindow(shifts[isoWeekdayOf(local.date) - 1], open, close)
    return !w || local.minute < w.start || local.minute + l.durationMinutes > w.end
  })
  if (affected.length) throw affectedError(affected)
}

export const _internal = { activeTechnicians, bookingRules }
