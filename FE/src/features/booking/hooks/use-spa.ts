'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AppointmentQuery,
  BusinessHoursDto,
  CancelAppointmentInput,
  CheckoutInput,
  CreateAppointmentInput,
  CreateDayOffInput,
  CustomerPackageQuery,
  CustomerQuery,
  InvoiceQuery,
  MoveLineInput,
  PackageSaleInput,
  PublicBookingInput,
  PublicSlotsQuery,
  ReportRangeQuery,
  SavePackageTemplateInput,
  SaveServiceGroupInput,
  SaveServiceInput,
  SaveStaffMemberInput,
  SaveCustomerInput,
  ShiftType,
  UpdateAppointmentInput,
} from '@/types/spa'
import { catalogService } from '../services/catalog.service'
import {
  appointmentService,
  commissionService,
  customerService,
  invoiceService,
  publicBookingService,
  reportService,
} from '../services/booking.service'

/**
 * Hook TanStack Query cho nghiệp vụ Spa. Mọi query nghiệp vụ dùng khóa bắt đầu bằng 'spa'; sau mỗi lần ghi làm mới cả nhóm
 * vì một thao tác (thanh toán, hủy lịch) chạm nhiều màn hình (lưới, tổng quan, gói, hoa hồng, khách).
 */

export const spaKeys = {
  all: ['spa'] as const,
  groups: ['spa', 'service-groups'] as const,
  services: (q: object = {}) => ['spa', 'services', q] as const,
  serviceOptions: ['spa', 'service-options'] as const,
  templates: ['spa', 'package-templates'] as const,
  templateOptions: ['spa', 'package-template-options'] as const,
  hours: ['spa', 'business-hours'] as const,
  store: ['spa', 'store-profile'] as const,
  staff: ['spa', 'staff'] as const,
  staffOptions: ['spa', 'staff-options'] as const,
  accounts: ['spa', 'account-candidates'] as const,
  daysOff: (q: object = {}) => ['spa', 'days-off', q] as const,
  board: (date: string) => ['spa', 'board', date] as const,
  appointments: (q: AppointmentQuery) => ['spa', 'appointments', q] as const,
  appointment: (id: string) => ['spa', 'appointment', id] as const,
  checkout: (id: string) => ['spa', 'checkout', id] as const,
  invoices: (q: InvoiceQuery) => ['spa', 'invoices', q] as const,
  invoice: (id: string) => ['spa', 'invoice', id] as const,
  packages: (q: CustomerPackageQuery) => ['spa', 'customer-packages', q] as const,
  package: (id: string) => ['spa', 'customer-package', id] as const,
  customers: (q: CustomerQuery) => ['spa', 'customers', q] as const,
  customer: (id: string) => ['spa', 'customer', id] as const,
  lookup: (phone: string) => ['spa', 'lookup', phone] as const,
  sheet: (month: string) => ['spa', 'commission-sheet', month] as const,
  items: (month: string, staffId: string) => ['spa', 'commission-items', month, staffId] as const,
  myCommissions: (month: string) => ['spa', 'my-commissions', month] as const,
  mySchedule: (date: string) => ['spa', 'my-schedule', date] as const,
  today: ['spa', 'dashboard-today'] as const,
  report: (kind: string, q: ReportRangeQuery) => ['spa', 'report', kind, q] as const,
}

function useInvalidateSpa() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: spaKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['public', 'booking'] })
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
  }
}

function useSpaMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const invalidate = useInvalidateSpa()
  return useMutation({ mutationFn: fn, onSuccess: invalidate })
}

// ───────────────────────────── Danh mục

export const useServiceGroups = () => useQuery({ queryKey: spaKeys.groups, queryFn: catalogService.getGroups })
export const useServices = (q: { groupId?: string; visible?: boolean } = {}) =>
  useQuery({ queryKey: spaKeys.services(q), queryFn: () => catalogService.getServices(q) })
export const useServiceOptions = (enabled = true) =>
  useQuery({ queryKey: spaKeys.serviceOptions, queryFn: catalogService.getServiceOptions, enabled })
export const usePackageTemplates = () => useQuery({ queryKey: spaKeys.templates, queryFn: catalogService.getTemplates })
export const usePackageTemplateOptions = (enabled = true) =>
  useQuery({ queryKey: spaKeys.templateOptions, queryFn: catalogService.getTemplateOptions, enabled })
export const useBusinessHours = () => useQuery({ queryKey: spaKeys.hours, queryFn: catalogService.getHours })
export const useStoreProfile = () =>
  useQuery({ queryKey: spaKeys.store, queryFn: catalogService.getStoreProfile, staleTime: 5 * 60_000 })
export const useStaff = () => useQuery({ queryKey: spaKeys.staff, queryFn: catalogService.getStaff })
export const useStaffOptions = () => useQuery({ queryKey: spaKeys.staffOptions, queryFn: catalogService.getStaffOptions })
export const useAccountCandidates = (enabled = true) =>
  useQuery({ queryKey: spaKeys.accounts, queryFn: catalogService.getAccountCandidates, enabled })
export const useDaysOff = (q: { from?: string; to?: string } = {}) =>
  useQuery({ queryKey: spaKeys.daysOff(q), queryFn: () => catalogService.getDaysOff(q) })

export const useCreateGroup = () => useSpaMutation((input: SaveServiceGroupInput) => catalogService.createGroup(input))
export const useUpdateGroup = () =>
  useSpaMutation(({ id, input }: { id: string; input: SaveServiceGroupInput }) => catalogService.updateGroup(id, input))
export const useReorderGroups = () => useSpaMutation((ids: string[]) => catalogService.reorderGroups(ids))
export const useDeleteGroup = () => useSpaMutation((id: string) => catalogService.deleteGroup(id))
export const useCreateService = () => useSpaMutation((input: SaveServiceInput) => catalogService.createService(input))
export const useUpdateService = () =>
  useSpaMutation(({ id, input }: { id: string; input: SaveServiceInput }) => catalogService.updateService(id, input))
export const useSetServiceVisibility = () =>
  useSpaMutation(({ id, isVisible }: { id: string; isVisible: boolean }) => catalogService.setServiceVisibility(id, isVisible))
export const useDeleteService = () => useSpaMutation((id: string) => catalogService.deleteService(id))
export const useCreateTemplate = () => useSpaMutation((input: SavePackageTemplateInput) => catalogService.createTemplate(input))
export const useUpdateTemplate = () =>
  useSpaMutation(({ id, input }: { id: string; input: SavePackageTemplateInput }) => catalogService.updateTemplate(id, input))
export const useSetTemplateActive = () =>
  useSpaMutation(({ id, isActive }: { id: string; isActive: boolean }) => catalogService.setTemplateActive(id, isActive))
export const useDeleteTemplate = () => useSpaMutation((id: string) => catalogService.deleteTemplate(id))
export const useUpdateHours = () => useSpaMutation((input: BusinessHoursDto) => catalogService.updateHours(input))
export const useCreateStaff = () => useSpaMutation((input: SaveStaffMemberInput) => catalogService.createStaff(input))
export const useUpdateStaff = () =>
  useSpaMutation(({ id, input }: { id: string; input: SaveStaffMemberInput }) => catalogService.updateStaff(id, input))
export const useUpdateShifts = () =>
  useSpaMutation(({ id, shifts }: { id: string; shifts: ShiftType[] }) => catalogService.updateShifts(id, shifts))
export const useSetStaffActive = () =>
  useSpaMutation(({ id, isActive }: { id: string; isActive: boolean }) => catalogService.setStaffActive(id, isActive))
export const useDeleteStaff = () => useSpaMutation((id: string) => catalogService.deleteStaff(id))
export const useCreateDayOff = () => useSpaMutation((input: CreateDayOffInput) => catalogService.createDayOff(input))
export const useDeleteDayOff = () => useSpaMutation((id: string) => catalogService.deleteDayOff(id))

// ───────────────────────────── Lịch hẹn

export const useBoard = (date: string) =>
  useQuery({
    queryKey: spaKeys.board(date),
    queryFn: () => appointmentService.getBoard(date),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
export const useAppointments = (q: AppointmentQuery, enabled = true) =>
  useQuery({ queryKey: spaKeys.appointments(q), queryFn: () => appointmentService.getList(q), placeholderData: keepPreviousData, enabled })
export const useAppointment = (id: string | null) =>
  useQuery({ queryKey: spaKeys.appointment(id ?? ''), queryFn: () => appointmentService.get(id!), enabled: !!id })
export const useCheckoutPreview = (id: string | null) =>
  useQuery({ queryKey: spaKeys.checkout(id ?? ''), queryFn: () => appointmentService.checkoutPreview(id!), enabled: !!id, staleTime: 0 })

export const useCreateAppointment = () => useSpaMutation((input: CreateAppointmentInput) => appointmentService.create(input))
export const useUpdateAppointment = () =>
  useSpaMutation(({ id, input }: { id: string; input: UpdateAppointmentInput }) => appointmentService.update(id, input))
export const useMoveLine = () =>
  useSpaMutation(({ id, lineId, input }: { id: string; lineId: string; input: MoveLineInput }) => appointmentService.moveLine(id, lineId, input))
export const useConfirmAppointment = () => useSpaMutation((id: string) => appointmentService.confirm(id))
export const useRejectAppointment = () =>
  useSpaMutation(({ id, input }: { id: string; input: CancelAppointmentInput }) => appointmentService.reject(id, input))
export const useCancelAppointment = () =>
  useSpaMutation(({ id, input }: { id: string; input: CancelAppointmentInput }) => appointmentService.cancel(id, input))
export const useCheckIn = () => useSpaMutation((id: string) => appointmentService.checkIn(id))
export const useNoShow = () => useSpaMutation((id: string) => appointmentService.noShow(id))

// ───────────────────────────── Thanh toán, gói

export const useCheckout = () => useSpaMutation((input: CheckoutInput) => invoiceService.checkout(input))
export const useSellPackage = () => useSpaMutation((input: PackageSaleInput) => invoiceService.sellPackage(input))
export const useInvoice = (id: string | null) =>
  useQuery({ queryKey: spaKeys.invoice(id ?? ''), queryFn: () => invoiceService.get(id!), enabled: !!id })
export const useInvoices = (q: InvoiceQuery, enabled = true) =>
  useQuery({ queryKey: spaKeys.invoices(q), queryFn: () => invoiceService.getList(q), placeholderData: keepPreviousData, enabled })
export const useCancelInvoice = () => useSpaMutation(({ id, reason }: { id: string; reason: string }) => invoiceService.cancel(id, reason))
export const useCustomerPackages = (q: CustomerPackageQuery, enabled = true) =>
  useQuery({ queryKey: spaKeys.packages(q), queryFn: () => invoiceService.getPackages(q), placeholderData: keepPreviousData, enabled })
export const useCustomerPackage = (id: string | null) =>
  useQuery({ queryKey: spaKeys.package(id ?? ''), queryFn: () => invoiceService.getPackage(id!), enabled: !!id })
export const useExtendPackage = () =>
  useSpaMutation(({ id, days, reason }: { id: string; days: number; reason: string }) => invoiceService.extendPackage(id, days, reason))

// ───────────────────────────── Khách hàng

export const useCustomers = (q: CustomerQuery) =>
  useQuery({ queryKey: spaKeys.customers(q), queryFn: () => customerService.getList(q), placeholderData: keepPreviousData })
export const useCustomer = (id: string | null) =>
  useQuery({ queryKey: spaKeys.customer(id ?? ''), queryFn: () => customerService.get(id!), enabled: !!id })
export const useCustomerLookup = (phone: string) =>
  useQuery({ queryKey: spaKeys.lookup(phone), queryFn: () => customerService.lookup(phone), enabled: /^0\d{9}$/.test(phone) })
export const useCreateCustomer = () => useSpaMutation((input: SaveCustomerInput) => customerService.create(input))
export const useUpdateCustomer = () =>
  useSpaMutation(({ id, input }: { id: string; input: SaveCustomerInput }) => customerService.update(id, input))

// ───────────────────────────── Hoa hồng, lịch của tôi

export const useCommissionSheet = (month: string) =>
  useQuery({ queryKey: spaKeys.sheet(month), queryFn: () => commissionService.getSheet(month), placeholderData: keepPreviousData })
export const useCommissionItems = (month: string, staffId: string | null) =>
  useQuery({ queryKey: spaKeys.items(month, staffId ?? ''), queryFn: () => commissionService.getItems(month, staffId!), enabled: !!staffId })
export const useCloseCommissions = () => useSpaMutation((month: string) => commissionService.close(month))
export const usePayCommissions = () => useSpaMutation((month: string) => commissionService.pay(month))
export const useMyCommissions = (month: string) =>
  useQuery({ queryKey: spaKeys.myCommissions(month), queryFn: () => commissionService.getMine(month) })
export const useMySchedule = (date: string) =>
  useQuery({ queryKey: spaKeys.mySchedule(date), queryFn: () => commissionService.getMySchedule(date), placeholderData: keepPreviousData })

// ───────────────────────────── Tổng quan, báo cáo

export const useDashboardToday = () => useQuery({ queryKey: spaKeys.today, queryFn: reportService.getToday, refetchInterval: 60_000 })
export const useRevenueReport = (q: ReportRangeQuery, enabled = true) =>
  useQuery({ queryKey: spaKeys.report('revenue', q), queryFn: () => reportService.getRevenue(q), placeholderData: keepPreviousData, enabled })
export const useServiceReport = (q: ReportRangeQuery, enabled = true) =>
  useQuery({ queryKey: spaKeys.report('services', q), queryFn: () => reportService.getServices(q), placeholderData: keepPreviousData, enabled })
export const useTechnicianReport = (q: ReportRangeQuery, enabled = true) =>
  useQuery({ queryKey: spaKeys.report('technicians', q), queryFn: () => reportService.getTechnicians(q), placeholderData: keepPreviousData, enabled })
export const usePackageReport = (q: ReportRangeQuery, enabled = true) =>
  useQuery({ queryKey: spaKeys.report('packages', q), queryFn: () => reportService.getPackages(q), placeholderData: keepPreviousData, enabled })
export const useCancellationReport = (q: ReportRangeQuery, enabled = true) =>
  useQuery({
    queryKey: spaKeys.report('cancellations', q),
    queryFn: () => reportService.getCancellations(q),
    placeholderData: keepPreviousData,
    enabled,
  })

// ───────────────────────────── Đặt lịch online (khóa 'public' không làm mới khi đổi người dùng)

export const usePublicCatalog = () => useQuery({ queryKey: ['public', 'booking', 'catalog'], queryFn: publicBookingService.getCatalog })
export const usePublicSlots = (q: PublicSlotsQuery | null) =>
  useQuery({
    queryKey: ['public', 'booking', 'slots', q],
    queryFn: () => publicBookingService.getSlots(q!),
    enabled: !!q && q.serviceIds.length > 0,
    staleTime: 0,
  })
export const usePublicBook = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PublicBookingInput) => publicBookingService.book(input),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['public', 'booking', 'slots'] }),
  })
}
export const usePublicLookup = () =>
  useMutation({ mutationFn: ({ code, phone }: { code: string; phone: string }) => publicBookingService.lookup(code, phone) })
export const usePublicCancel = () =>
  useMutation({
    mutationFn: ({ code, phone, reason }: { code: string; phone: string; reason?: string | null }) => publicBookingService.cancel(code, phone, reason),
  })
