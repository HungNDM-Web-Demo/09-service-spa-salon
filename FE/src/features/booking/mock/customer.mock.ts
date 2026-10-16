import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { auditCreate, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { listQuery, newId } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type { CustomerDto, CustomerLookupDto, CustomerQuery, SaveCustomerInput } from '@/types/spa'
import { bookingRules, digitsOnly } from '../lib/rules'
import { phoneError } from '../lib/validation'
import { conflictError, fieldErrors, notFoundError } from './errors'
import type { CustomerRecord } from './records'
import { customerDto, customerPackages, customersDb, ensureFresh, nextCatalogCode, noShowCount90, nowIso, packagesDb } from './store'

/** Handler mock hồ sơ khách (07 §4.9). */

export function nextCustomerCode(): string {
  return nextCatalogCode(customersDb.all().map((c) => c.code), 'KH', 5)
}

function validate(input: SaveCustomerInput): Record<string, string> {
  const e: Record<string, string> = {}
  const phone = phoneError(input.phone)
  if (phone) e.phone = phone
  if (!input.fullName?.trim()) e.fullName = 'Nhập họ tên'
  if ((input.note ?? '').length > 500) e.note = 'Ghi chú tối đa 500 ký tự'
  return e
}

const apply = (input: SaveCustomerInput) => ({
  fullName: input.fullName.trim(),
  birthDate: input.birthDate || null,
  gender: input.gender ?? null,
  note: input.note?.trim() || null,
})

export const customerMock = {
  async getList(query: CustomerQuery): Promise<PaginatedResult<CustomerDto>> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    ensureFresh()
    let list = customersDb.all()
    if (query.flagged) list = list.filter((c) => noShowCount90(c.id) >= bookingRules.noShowFlagThreshold)
    if (query.hasActivePackage) list = list.filter((c) => packagesDb.some((p) => p.customerId === c.id && p.status === 'DangDung'))
    // Số điện thoại gõ kèm khoảng trắng ("0903 123 456") vẫn tìm được
    const digits = digitsOnly(query.search ?? '')
    const search = /^\d{3,}$/.test(digits) ? digits : query.search
    const page = listQuery<CustomerRecord>(list, { ...query, search }, { searchFields: ['code', 'fullName', 'phone'] })
    return { ...page, items: page.items.map(customerDto) }
  },

  async lookup(phone: string): Promise<CustomerLookupDto> {
    await mockDelay(80, 160)
    requirePermission(permissions.customers.view, permissions.appointments.create, permissions.customerPackages.sell)
    ensureFresh()
    const digits = digitsOnly(phone ?? '')
    const customer = digits ? customersDb.find((c) => c.phone === digits) : undefined
    if (!customer) return { customer: null, packages: [] }
    return {
      customer: customerDto(customer),
      packages: customerPackages(customer.id).filter((p) => p.status === 'DangDung' || p.status === 'HetHan'),
    }
  },

  async get(id: string): Promise<CustomerDto> {
    await mockDelay()
    requirePermission(permissions.customers.view)
    ensureFresh()
    const c = customersDb.get(id)
    if (!c) throw notFoundError('Không tìm thấy khách.')
    return customerDto(c)
  },

  async create(input: SaveCustomerInput): Promise<CustomerDto> {
    await mockDelay()
    requirePermission(permissions.customers.create)
    ensureFresh()
    const errors = validate(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const phone = digitsOnly(input.phone)
    if (customersDb.some((c) => c.phone === phone)) throw conflictError(null, `Số điện thoại ${phone} đã có hồ sơ khách.`, 'phone')
    const customer = customersDb.insert({ id: newId(), code: nextCustomerCode(), phone, ...apply(input), createdAt: nowIso() })
    auditCreate('Customer', customer)
    return customerDto(customer)
  },

  async update(id: string, input: SaveCustomerInput): Promise<CustomerDto> {
    await mockDelay()
    requirePermission(permissions.customers.update)
    ensureFresh()
    const before = customersDb.get(id)
    if (!before) throw notFoundError('Không tìm thấy khách.')
    const errors = validate(input)
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const phone = digitsOnly(input.phone)
    if (customersDb.some((c) => c.phone === phone && c.id !== id)) throw conflictError(null, `Số điện thoại ${phone} đã có hồ sơ khách.`, 'phone')
    const after = customersDb.update(id, { phone, ...apply(input) })!
    auditUpdate('Customer', before, after)
    return customerDto(after)
  },
}
