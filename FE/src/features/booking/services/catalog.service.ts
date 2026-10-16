import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type {
  AccountCandidate,
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
import { catalogMock } from '../mock/catalog.mock'

/** Nhóm dịch vụ, dịch vụ, gói mẫu, giờ mở cửa, nhân viên, ngày nghỉ (07 §4.1–4.3). */
export const catalogService = {
  getGroups: (): Promise<ServiceGroupDto[]> => (isMockMode() ? catalogMock.getGroups() : apiCall.get(apiRoutes.serviceGroups.list)),
  createGroup: (input: SaveServiceGroupInput): Promise<ServiceGroupDto> =>
    isMockMode() ? catalogMock.createGroup(input) : apiCall.post(apiRoutes.serviceGroups.list, input),
  updateGroup: (id: string, input: SaveServiceGroupInput): Promise<ServiceGroupDto> =>
    isMockMode() ? catalogMock.updateGroup(id, input) : apiCall.put(apiRoutes.serviceGroups.detail(id), input),
  reorderGroups: (ids: string[]): Promise<void> =>
    isMockMode() ? catalogMock.reorderGroups(ids) : apiCall.put(apiRoutes.serviceGroups.order, { ids }),
  deleteGroup: (id: string): Promise<void> =>
    isMockMode() ? catalogMock.deleteGroup(id) : apiCall.delete(apiRoutes.serviceGroups.detail(id)),

  getServices: (query: { groupId?: string; visible?: boolean } = {}): Promise<ServiceDto[]> =>
    isMockMode() ? catalogMock.getServices(query) : apiCall.get(apiRoutes.services.list, { params: query }),
  getServiceOptions: (): Promise<ServiceOption[]> =>
    isMockMode() ? catalogMock.getServiceOptions() : apiCall.get(apiRoutes.services.options),
  nextServiceCode: (): Promise<NextCodeDto> => (isMockMode() ? catalogMock.nextServiceCode() : apiCall.get(apiRoutes.services.nextCode)),
  createService: (input: SaveServiceInput): Promise<ServiceDto> =>
    isMockMode() ? catalogMock.createService(input) : apiCall.post(apiRoutes.services.list, input),
  updateService: (id: string, input: SaveServiceInput): Promise<ServiceDto> =>
    isMockMode() ? catalogMock.updateService(id, input) : apiCall.put(apiRoutes.services.detail(id), input),
  setServiceVisibility: (id: string, isVisible: boolean): Promise<ServiceDto> =>
    isMockMode() ? catalogMock.setServiceVisibility(id, isVisible) : apiCall.patch(apiRoutes.services.visibility(id), { isVisible }),
  deleteService: (id: string): Promise<void> =>
    isMockMode() ? catalogMock.deleteService(id) : apiCall.delete(apiRoutes.services.detail(id)),

  getTemplates: (): Promise<PackageTemplateDto[]> => (isMockMode() ? catalogMock.getTemplates() : apiCall.get(apiRoutes.packageTemplates.list)),
  getTemplateOptions: (): Promise<PackageTemplateDto[]> =>
    isMockMode() ? catalogMock.getTemplateOptions() : apiCall.get(apiRoutes.packageTemplates.options),
  nextTemplateCode: (): Promise<NextCodeDto> =>
    isMockMode() ? catalogMock.nextTemplateCode() : apiCall.get(apiRoutes.packageTemplates.nextCode),
  createTemplate: (input: SavePackageTemplateInput): Promise<PackageTemplateDto> =>
    isMockMode() ? catalogMock.createTemplate(input) : apiCall.post(apiRoutes.packageTemplates.list, input),
  updateTemplate: (id: string, input: SavePackageTemplateInput): Promise<PackageTemplateDto> =>
    isMockMode() ? catalogMock.updateTemplate(id, input) : apiCall.put(apiRoutes.packageTemplates.detail(id), input),
  setTemplateActive: (id: string, isActive: boolean): Promise<PackageTemplateDto> =>
    isMockMode() ? catalogMock.setTemplateActive(id, isActive) : apiCall.patch(apiRoutes.packageTemplates.status(id), { isActive }),
  deleteTemplate: (id: string): Promise<void> =>
    isMockMode() ? catalogMock.deleteTemplate(id) : apiCall.delete(apiRoutes.packageTemplates.detail(id)),

  getHours: (): Promise<BusinessHoursDto> => (isMockMode() ? catalogMock.getHours() : apiCall.get(apiRoutes.businessHours)),
  updateHours: (input: BusinessHoursDto): Promise<BusinessHoursDto> =>
    isMockMode() ? catalogMock.updateHours(input) : apiCall.put(apiRoutes.businessHours, input),
  getStoreProfile: (): Promise<StoreProfileDto> =>
    isMockMode() ? catalogMock.getStoreProfile() : apiCall.get(apiRoutes.storeProfile),

  getStaff: (): Promise<StaffMemberDto[]> => (isMockMode() ? catalogMock.getStaff() : apiCall.get(apiRoutes.staffMembers.list)),
  getStaffOptions: (): Promise<StaffOption[]> =>
    isMockMode() ? catalogMock.getStaffOptions() : apiCall.get(apiRoutes.staffMembers.options),
  getAccountCandidates: (): Promise<AccountCandidate[]> =>
    isMockMode() ? catalogMock.getAccountCandidates() : apiCall.get(apiRoutes.staffMembers.accountCandidates),
  nextStaffCode: (): Promise<NextCodeDto> => (isMockMode() ? catalogMock.nextStaffCode() : apiCall.get(apiRoutes.staffMembers.nextCode)),
  createStaff: (input: SaveStaffMemberInput): Promise<StaffMemberDto> =>
    isMockMode() ? catalogMock.createStaff(input) : apiCall.post(apiRoutes.staffMembers.list, input),
  updateStaff: (id: string, input: SaveStaffMemberInput): Promise<StaffMemberDto> =>
    isMockMode() ? catalogMock.updateStaff(id, input) : apiCall.put(apiRoutes.staffMembers.detail(id), input),
  updateShifts: (id: string, shifts: ShiftType[]): Promise<StaffMemberDto> =>
    isMockMode() ? catalogMock.updateShifts(id, shifts) : apiCall.put(apiRoutes.staffMembers.shifts(id), { shifts }),
  setStaffActive: (id: string, isActive: boolean): Promise<StaffMemberDto> =>
    isMockMode() ? catalogMock.setStaffActive(id, isActive) : apiCall.patch(apiRoutes.staffMembers.status(id), { isActive }),
  deleteStaff: (id: string): Promise<void> =>
    isMockMode() ? catalogMock.deleteStaff(id) : apiCall.delete(apiRoutes.staffMembers.detail(id)),

  getDaysOff: (query: { from?: string; to?: string } = {}): Promise<DayOffDto[]> =>
    isMockMode() ? catalogMock.getDaysOff(query) : apiCall.get(apiRoutes.daysOff.list, { params: query }),
  createDayOff: (input: CreateDayOffInput): Promise<DayOffDto> =>
    isMockMode() ? catalogMock.createDayOff(input) : apiCall.post(apiRoutes.daysOff.list, input),
  deleteDayOff: (id: string): Promise<void> =>
    isMockMode() ? catalogMock.deleteDayOff(id) : apiCall.delete(apiRoutes.daysOff.detail(id)),
}
