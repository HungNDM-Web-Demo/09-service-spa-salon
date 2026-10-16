import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  AppointmentDetailDto,
  AppointmentListItem,
  AppointmentQuery,
  BoardDto,
  CancelAppointmentInput,
  CancellationReportDto,
  CheckAppointmentInput,
  CheckoutInput,
  CheckoutPreviewDto,
  CheckResultDto,
  CommissionItemDto,
  CommissionSheetDto,
  CreateAppointmentInput,
  CustomerDto,
  CustomerLookupDto,
  CustomerPackageDetailDto,
  CustomerPackageDto,
  CustomerPackageQuery,
  CustomerQuery,
  DashboardTodayDto,
  InvoiceDto,
  InvoiceQuery,
  MoveLineInput,
  MyCommissionsDto,
  MyScheduleDto,
  PackageReportDto,
  PackageSaleInput,
  PublicAppointmentDto,
  PublicBookingInput,
  PublicCatalogDto,
  PublicSlotsDto,
  PublicSlotsQuery,
  ReportRangeQuery,
  RevenueReportDto,
  SaveCustomerInput,
  ServiceReportDto,
  SuggestionQuery,
  SuggestionsDto,
  TechnicianReportDto,
  UpdateAppointmentInput,
} from '@/types/spa'
import { appointmentMock } from '../mock/appointment.mock'
import { commissionMock } from '../mock/commission.mock'
import { customerMock } from '../mock/customer.mock'
import { invoiceMock } from '../mock/invoice.mock'
import { publicMock } from '../mock/public.mock'
import { reportMock } from '../mock/report.mock'

/** Lịch hẹn (07 §4.4) */
export const appointmentService = {
  getBoard: (date: string): Promise<BoardDto> =>
    isMockMode() ? appointmentMock.getBoard(date) : apiCall.get(apiRoutes.appointments.board, { params: { date } }),
  getList: (query: AppointmentQuery): Promise<PaginatedResult<AppointmentListItem>> =>
    isMockMode() ? appointmentMock.getList(query) : apiCall.get(apiRoutes.appointments.list, { params: query }),
  get: (id: string): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.get(id) : apiCall.get(apiRoutes.appointments.detail(id)),
  check: (input: CheckAppointmentInput): Promise<CheckResultDto> =>
    isMockMode() ? appointmentMock.check(input) : apiCall.post(apiRoutes.appointments.check, input),
  suggest: (query: SuggestionQuery): Promise<SuggestionsDto> =>
    isMockMode() ? appointmentMock.suggest(query) : apiCall.get(apiRoutes.appointments.suggestions, { params: query }),
  create: (input: CreateAppointmentInput): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.create(input) : apiCall.post(apiRoutes.appointments.list, input),
  update: (id: string, input: UpdateAppointmentInput): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.update(id, input) : apiCall.put(apiRoutes.appointments.detail(id), input),
  moveLine: (id: string, lineId: string, input: MoveLineInput): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.moveLine(id, lineId, input) : apiCall.patch(apiRoutes.appointments.line(id, lineId), input),
  confirm: (id: string): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.confirm(id) : apiCall.post(apiRoutes.appointments.confirm(id)),
  reject: (id: string, input: CancelAppointmentInput): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.reject(id, input) : apiCall.post(apiRoutes.appointments.reject(id), input),
  cancel: (id: string, input: CancelAppointmentInput): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.cancel(id, input) : apiCall.post(apiRoutes.appointments.cancel(id), input),
  checkIn: (id: string): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.checkIn(id) : apiCall.post(apiRoutes.appointments.checkIn(id)),
  noShow: (id: string): Promise<AppointmentDetailDto> =>
    isMockMode() ? appointmentMock.noShow(id) : apiCall.post(apiRoutes.appointments.noShow(id)),
  checkoutPreview: (id: string): Promise<CheckoutPreviewDto> =>
    isMockMode() ? appointmentMock.checkoutPreview(id) : apiCall.get(apiRoutes.appointments.checkout(id)),
}

/** Đặt lịch online công khai (07 §4.5) */
export const publicBookingService = {
  getCatalog: (): Promise<PublicCatalogDto> => (isMockMode() ? publicMock.getCatalog() : apiCall.get(apiRoutes.publicBooking.catalog)),
  getSlots: (query: PublicSlotsQuery): Promise<PublicSlotsDto> =>
    isMockMode()
      ? publicMock.getSlots(query)
      : apiCall.get(apiRoutes.publicBooking.slots, {
          params: { serviceIds: query.serviceIds.join(','), staffMemberId: query.staffMemberId || undefined, date: query.date },
        }),
  book: (input: PublicBookingInput): Promise<PublicAppointmentDto> =>
    isMockMode() ? publicMock.book(input) : apiCall.post(apiRoutes.publicBooking.book, input),
  lookup: (code: string, phone: string): Promise<PublicAppointmentDto> =>
    isMockMode() ? publicMock.lookup(code, phone) : apiCall.post(apiRoutes.publicBooking.lookup, { code, phone }),
  cancel: (code: string, phone: string, reason?: string | null): Promise<PublicAppointmentDto> =>
    isMockMode() ? publicMock.cancel(code, phone, reason) : apiCall.post(apiRoutes.publicBooking.cancel, { code, phone, reason }),
}

/** Thanh toán, hóa đơn, gói của khách (07 §4.6, §4.7) */
export const invoiceService = {
  checkout: (input: CheckoutInput): Promise<InvoiceDto> =>
    isMockMode() ? invoiceMock.checkout(input) : apiCall.post(apiRoutes.invoices.checkout, input),
  sellPackage: (input: PackageSaleInput): Promise<InvoiceDto> =>
    isMockMode() ? invoiceMock.sellPackage(input) : apiCall.post(apiRoutes.invoices.packageSale, input),
  get: (id: string): Promise<InvoiceDto> => (isMockMode() ? invoiceMock.get(id) : apiCall.get(apiRoutes.invoices.detail(id))),
  getList: (query: InvoiceQuery): Promise<PaginatedResult<InvoiceDto>> =>
    isMockMode() ? invoiceMock.getList(query) : apiCall.get(apiRoutes.invoices.list, { params: query }),
  cancel: (id: string, reason: string): Promise<InvoiceDto> =>
    isMockMode() ? invoiceMock.cancel(id, reason) : apiCall.post(apiRoutes.invoices.cancel(id), { reason }),
  getPackages: (query: CustomerPackageQuery): Promise<PaginatedResult<CustomerPackageDto>> =>
    isMockMode() ? invoiceMock.getPackages(query) : apiCall.get(apiRoutes.customerPackages.list, { params: query }),
  getPackage: (id: string): Promise<CustomerPackageDetailDto> =>
    isMockMode() ? invoiceMock.getPackage(id) : apiCall.get(apiRoutes.customerPackages.detail(id)),
  extendPackage: (id: string, days: number, reason: string): Promise<CustomerPackageDetailDto> =>
    isMockMode() ? invoiceMock.extendPackage(id, days, reason) : apiCall.post(apiRoutes.customerPackages.extend(id), { days, reason }),
}

/** Khách hàng (07 §4.9) */
export const customerService = {
  getList: (query: CustomerQuery): Promise<PaginatedResult<CustomerDto>> =>
    isMockMode() ? customerMock.getList(query) : apiCall.get(apiRoutes.customers.list, { params: query }),
  lookup: (phone: string): Promise<CustomerLookupDto> =>
    isMockMode() ? customerMock.lookup(phone) : apiCall.get(apiRoutes.customers.lookup, { params: { phone } }),
  get: (id: string): Promise<CustomerDto> => (isMockMode() ? customerMock.get(id) : apiCall.get(apiRoutes.customers.detail(id))),
  create: (input: SaveCustomerInput): Promise<CustomerDto> =>
    isMockMode() ? customerMock.create(input) : apiCall.post(apiRoutes.customers.list, input),
  update: (id: string, input: SaveCustomerInput): Promise<CustomerDto> =>
    isMockMode() ? customerMock.update(id, input) : apiCall.put(apiRoutes.customers.detail(id), input),
}

/** Hoa hồng, lịch của tôi (07 §4.8) */
export const commissionService = {
  getSheet: (month: string): Promise<CommissionSheetDto> =>
    isMockMode() ? commissionMock.getSheet(month) : apiCall.get(apiRoutes.commissions.sheet, { params: { month } }),
  getItems: (month: string, staffMemberId: string): Promise<CommissionItemDto[]> =>
    isMockMode()
      ? commissionMock.getItems(month, staffMemberId)
      : apiCall.get(apiRoutes.commissions.items, { params: { month, staffMemberId } }),
  close: (month: string): Promise<CommissionSheetDto> =>
    isMockMode() ? commissionMock.close(month) : apiCall.post(apiRoutes.commissions.close(month)),
  pay: (month: string): Promise<CommissionSheetDto> => (isMockMode() ? commissionMock.pay(month) : apiCall.post(apiRoutes.commissions.pay(month))),
  getMine: (month?: string): Promise<MyCommissionsDto> =>
    isMockMode() ? commissionMock.getMine(month) : apiCall.get(apiRoutes.commissions.my, { params: { month } }),
  getMySchedule: (date: string): Promise<MyScheduleDto> =>
    isMockMode() ? commissionMock.getMySchedule(date) : apiCall.get(apiRoutes.mySchedule, { params: { date } }),
}

/** Tổng quan, báo cáo (07 §4.10) */
export const reportService = {
  getToday: (): Promise<DashboardTodayDto> => (isMockMode() ? reportMock.getToday() : apiCall.get(apiRoutes.dashboard.today)),
  getRevenue: (query: ReportRangeQuery): Promise<RevenueReportDto> =>
    isMockMode() ? reportMock.getRevenue(query) : apiCall.get(apiRoutes.reports.revenue, { params: query }),
  getServices: (query: ReportRangeQuery): Promise<ServiceReportDto> =>
    isMockMode() ? reportMock.getServices(query) : apiCall.get(apiRoutes.reports.services, { params: query }),
  getTechnicians: (query: ReportRangeQuery): Promise<TechnicianReportDto> =>
    isMockMode() ? reportMock.getTechnicians(query) : apiCall.get(apiRoutes.reports.technicians, { params: query }),
  getPackages: (query: ReportRangeQuery): Promise<PackageReportDto> =>
    isMockMode() ? reportMock.getPackages(query) : apiCall.get(apiRoutes.reports.packages, { params: query }),
  getCancellations: (query: ReportRangeQuery): Promise<CancellationReportDto> =>
    isMockMode() ? reportMock.getCancellations(query) : apiCall.get(apiRoutes.reports.cancellations, { params: query }),
}
