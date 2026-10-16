import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import type {
  AppointmentSource,
  CancellationReportDto,
  DashboardCard,
  DashboardTodayDto,
  PackageReportDto,
  ReportRangeQuery,
  RevenueReportDto,
  RevenueTotals,
  ServiceReportDto,
  TechnicianReportDto,
} from '@/types/spa'
import { bookingRules, shiftWindow } from '../lib/rules'
import { addDaysKey, diffDaysKey, isoWeekdayOf, vnDateKey } from '../lib/vn-time'
import { fieldErrors } from './errors'
import { commissionItems, packageDto } from './mappers'
import type { AppointmentRecord, InvoiceRecord } from './records'
import {
  actor,
  appointmentsDb,
  customersDb,
  daysOffDb,
  ensureFresh,
  hours,
  invoicesDb,
  packagesDb,
  servicesDb,
  groupsDb,
  staffDb,
  staffName,
  templatesDb,
  today,
} from './store'

/** Handler mock tổng quan hôm nay và báo cáo (07 §3.11, §4.10), giống DashboardService, ReportService của BE. */

function card(a: AppointmentRecord): DashboardCard {
  const lines = [...a.lines].sort((x, y) => x.sortOrder - y.sortOrder)
  const now = Date.now()
  return {
    id: a.id,
    code: a.code,
    status: a.status,
    source: a.source,
    customerName: customersDb.get(a.customerId)?.fullName ?? '',
    startAt: a.startAt,
    endAt: a.endAt,
    services: lines.map((l) => l.serviceName).join(', '),
    staffNames: [...new Set(lines.map((l) => staffName(l.staffMemberId)))].join(', '),
    createdAt: a.createdAt,
    pendingOverdue: a.status === 'ChoXacNhan' && now - new Date(a.createdAt).getTime() > bookingRules.pendingOverdueMinutes * 60_000,
    isLate:
      (a.status === 'ChoXacNhan' || a.status === 'DaXacNhan') &&
      vnDateKey(a.startAt) === vnDateKey(now) &&
      now >= new Date(a.startAt).getTime() + bookingRules.lateMinutes * 60_000,
  }
}

function range(query: ReportRangeQuery): { from: string; to: string } {
  let from = query.from || addDaysKey(today(), -29)
  let to = query.to || today()
  if (to < from) [from, to] = [to, from]
  if (diffDaysKey(from, to) + 1 > bookingRules.maxReportDays) throw fieldErrors({ to: 'Khoảng ngày tối đa 366 ngày' })
  return { from, to }
}

const paid = (from: string, to: string): InvoiceRecord[] =>
  invoicesDb.filter((i) => i.status === 'DaThanhToan' && vnDateKey(i.paidAt) >= from && vnDateKey(i.paidAt) <= to)

function totals(list: InvoiceRecord[], from: string, to: string): RevenueTotals {
  return {
    from,
    to,
    serviceRevenue: list.reduce((s, i) => s + i.serviceTotal - i.discountAmount, 0),
    packageRevenue: list.reduce((s, i) => s + i.packageTotal, 0),
    revenue: list.reduce((s, i) => s + i.total, 0),
    serviceValue: list.reduce((s, i) => s + i.lines.filter((l) => l.kind === 'DichVu').reduce((x, l) => x + l.basePrice, 0), 0),
    invoiceCount: list.length,
    discount: list.reduce((s, i) => s + i.discountAmount, 0),
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10

export const reportMock = {
  async getToday(): Promise<DashboardTodayDto> {
    await mockDelay()
    requirePermission(permissions.dashboard.view)
    ensureFresh()
    const day = today()
    const now = Date.now()
    const closed = daysOffDb.find((d) => d.date === day && d.staffMemberId === null)
    const todays = appointmentsDb.filter((a) => a.date === day)
    const limit = now + 2 * 3600_000
    return {
      date: day,
      shopClosedReason: closed?.reason ?? null,
      counts: {
        total: todays.filter((a) => a.status !== 'DaHuy').length,
        pending: todays.filter((a) => a.status === 'ChoXacNhan').length,
        confirmed: todays.filter((a) => a.status === 'DaXacNhan').length,
        inService: todays.filter((a) => a.status === 'DangPhucVu').length,
        completed: todays.filter((a) => a.status === 'HoanThanh').length,
        noShow: todays.filter((a) => a.status === 'KhongDen').length,
        cancelled: todays.filter((a) => a.status === 'DaHuy').length,
      },
      revenueToday: paid(day, day).reduce((s, i) => s + i.total, 0),
      newCustomersToday: customersDb.count((c) => vnDateKey(c.createdAt) === day),
      upcoming: todays
        .filter((a) => {
          const start = new Date(a.startAt).getTime()
          return (a.status === 'ChoXacNhan' || a.status === 'DaXacNhan') && start >= now - bookingRules.lateMinutes * 60_000 && start <= limit
        })
        .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
        .map(card),
      pendingOnline: appointmentsDb
        .filter((a) => a.status === 'ChoXacNhan' && a.date >= day)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .map(card),
      tomorrow: closed
        ? appointmentsDb
            .filter((a) => a.date === addDaysKey(day, 1) && (a.status === 'ChoXacNhan' || a.status === 'DaXacNhan'))
            .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
            .map(card)
        : [],
    }
  },

  async getRevenue(query: ReportRangeQuery): Promise<RevenueReportDto> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    ensureFresh()
    const { from, to } = range(query)
    const length = diffDaysKey(from, to) + 1
    const prevTo = addDaysKey(from, -1)
    const prevFrom = addDaysKey(prevTo, -(length - 1))
    const list = paid(from, to)
    const days = Array.from({ length }, (_, i) => {
      const date = addDaysKey(from, i)
      const t = totals(
        list.filter((x) => vnDateKey(x.paidAt) === date),
        date,
        date
      )
      return {
        date,
        serviceRevenue: t.serviceRevenue,
        packageRevenue: t.packageRevenue,
        revenue: t.revenue,
        serviceValue: t.serviceValue,
        invoiceCount: t.invoiceCount,
        discount: t.discount,
      }
    })
    return { from, to, days, totals: totals(list, from, to), previous: totals(paid(prevFrom, prevTo), prevFrom, prevTo) }
  },

  async getServices(query: ReportRangeQuery): Promise<ServiceReportDto> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    ensureFresh()
    const { from, to } = range(query)
    let lines = paid(from, to).flatMap((i) => i.lines.filter((l) => l.kind === 'DichVu'))
    if (query.groupId) lines = lines.filter((l) => servicesDb.get(l.serviceId)?.groupId === query.groupId)
    const totalValue = lines.reduce((s, l) => s + l.basePrice, 0)
    const ids = [...new Set(lines.map((l) => l.serviceId))]
    const rows = ids
      .map((id) => {
        const s = servicesDb.get(id)
        const mine = lines.filter((l) => l.serviceId === id)
        const value = mine.reduce((x, l) => x + l.basePrice, 0)
        return {
          serviceId: id,
          code: s?.code ?? '',
          name: s?.name ?? '',
          groupName: s ? (groupsDb.get(s.groupId)?.name ?? '') : '',
          count: mine.length,
          value,
          share: totalValue > 0 ? round1((value * 100) / totalValue) : 0,
          packageCount: mine.filter((l) => l.usesPackage).length,
        }
      })
      .sort((a, b) => b.value - a.value || (a.code < b.code ? -1 : 1))
    return { rows, totalCount: lines.length, totalValue, totalPackageCount: lines.filter((l) => l.usesPackage).length }
  },

  async getTechnicians(query: ReportRangeQuery): Promise<TechnicianReportDto> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    ensureFresh()
    const { from, to } = range(query)
    const lines = paid(from, to).flatMap((i) => i.lines.filter((l) => l.kind === 'DichVu'))
    const earned = commissionItems((i) => vnDateKey(i.paidAt) >= from && vnDateKey(i.paidAt) <= to)
    const { open, close } = hours()
    const lastDay = to < today() ? to : today()
    const rows = staffDb
      .filter((s) => s.kind === 'KyThuatVien')
      .map((s) => {
        const mine = lines.filter((l) => l.staffMemberId === s.id)
        let shiftMinutes = 0
        for (let d = from; d <= lastDay; d = addDaysKey(d, 1)) {
          if (daysOffDb.some((o) => o.date === d && (o.staffMemberId === null || o.staffMemberId === s.id))) continue
          const w = shiftWindow(s.shifts[isoWeekdayOf(d) - 1] ?? 'Nghi', open, close)
          if (w) shiftMinutes += w.end - w.start
        }
        const booked = mine.reduce((x, l) => x + l.durationMinutes, 0)
        return {
          staffMemberId: s.id,
          code: s.code,
          fullName: s.fullName,
          count: mine.length,
          value: mine.reduce((x, l) => x + l.basePrice, 0),
          bookedMinutes: booked,
          shiftMinutes,
          occupancy: shiftMinutes > 0 ? round1((booked * 100) / shiftMinutes) : 0,
          commission: earned.filter((c) => c.staffMemberId === s.id).reduce((x, c) => x + c.amount, 0),
          active: s.isActive,
        }
      })
      .filter((r) => r.count > 0 || r.active)
      .sort((a, b) => b.value - a.value || (a.code < b.code ? -1 : 1))
      .map((r) => {
        const { active, ...row } = r
        void active
        return row
      })
    return { rows }
  },

  async getPackages(query: ReportRangeQuery): Promise<PackageReportDto> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    ensureFresh()
    const { from, to } = range(query)
    const invoices = paid(from, to)
    const sold = invoices.flatMap((i) => i.lines.filter((l) => l.kind === 'BanGoi'))
    const usedTemplateIds = invoices.flatMap((i) =>
      i.lines.filter((l) => l.usesPackage && l.customerPackageId).map((l) => packagesDb.get(l.customerPackageId!)?.packageTemplateId)
    )
    const active = packagesDb.filter((p) => p.status === 'DangDung')
    const day = today()
    const soon = addDaysKey(day, bookingRules.expiringSoonDays)
    const ids = [...new Set([...sold.map((l) => l.packageTemplateId!), ...usedTemplateIds.filter((x): x is string => !!x)])]
    const me = actor()
    return {
      soldCount: sold.length,
      soldAmount: sold.reduce((s, l) => s + l.amount, 0),
      activeCount: active.length,
      unusedSessions: active.reduce((s, p) => s + p.totalSessions - p.usedSessions, 0),
      unusedValue: active.reduce((s, p) => s + (p.totalSessions - p.usedSessions) * p.sessionValue, 0),
      rows: ids
        .map((id) => {
          const t = templatesDb.get(id)
          const mine = sold.filter((l) => l.packageTemplateId === id)
          return {
            packageTemplateId: id,
            code: t?.code ?? '',
            name: t?.name ?? mine[0]?.description ?? '',
            soldCount: mine.length,
            soldAmount: mine.reduce((s, l) => s + l.amount, 0),
            usedSessions: usedTemplateIds.filter((x) => x === id).length,
          }
        })
        .sort((a, b) => b.soldAmount - a.soldAmount),
      expiringSoon: active
        .filter((p) => p.expiryDate >= day && p.expiryDate <= soon)
        .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1))
        .map((p) => ({ ...packageDto(p, me), canExtend: false, lastUsedAt: null, invoiceCode: '' })),
    }
  },

  async getCancellations(query: ReportRangeQuery): Promise<CancellationReportDto> {
    await mockDelay()
    requirePermission(permissions.reports.view)
    ensureFresh()
    const { from, to } = range(query)
    const rows = appointmentsDb.filter((a) => a.date >= from && a.date <= to)
    const total = rows.length
    const cancelled = rows.filter((a) => a.status === 'DaHuy').length
    const noShow = rows.filter((a) => a.status === 'KhongDen').length
    const sources: AppointmentSource[] = ['Online', 'DienThoai', 'VangLai', 'ZaloFacebook']
    return {
      total,
      cancelled,
      noShow,
      cancelRate: total > 0 ? round1((cancelled * 100) / total) : 0,
      noShowRate: total > 0 ? round1((noShow * 100) / total) : 0,
      bySource: sources.map((source) => {
        const mine = rows.filter((a) => a.source === source)
        return {
          source,
          total: mine.length,
          cancelled: mine.filter((a) => a.status === 'DaHuy').length,
          noShow: mine.filter((a) => a.status === 'KhongDen').length,
        }
      }),
    }
  },
}
