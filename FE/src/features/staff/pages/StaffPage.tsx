'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { UserCog } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { useStaff } from '@/features/booking/hooks/use-spa'
import { BusinessHoursTab } from '../components/BusinessHoursTab'
import { DaysOffTab } from '../components/DaysOffTab'
import { StaffListTab } from '../components/StaffListTab'
import { WeeklyScheduleTab } from '../components/WeeklyScheduleTab'

const TABS = ['staff', 'schedule', 'days-off', 'hours'] as const
type StaffTab = (typeof TABS)[number]

/**
 * Nhân viên (SCR-11; UC-02, FR-05, FR-06, FR-07): tab Nhân viên, Lịch tuần, Ngày nghỉ, Giờ mở cửa; đồng bộ `?tab=`.
 * Lễ tân chỉ xem.
 */
export function StaffPage() {
  return (
    <PermissionGuard permission={permissions.staffMembers.view} redirect>
      <StaffView />
    </PermissionGuard>
  )
}

function StaffView() {
  const { canAny } = usePermissions()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const param = params.get('tab')
  const tab: StaffTab = TABS.includes(param as StaffTab) ? (param as StaffTab) : 'staff'
  const staff = useStaff()
  const readOnly = !canAny([
    permissions.staffMembers.create,
    permissions.staffMembers.update,
    permissions.staffMembers.delete,
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhân viên"
        icon={UserCog}
        description={
          readOnly
            ? 'Danh sách nhân viên, ca làm theo tuần, ngày nghỉ và giờ mở cửa. Chỉ chủ tiệm thay đổi được.'
            : 'Hồ sơ nhân viên, dịch vụ kỹ thuật viên làm được, ca làm theo tuần, ngày nghỉ và giờ mở cửa.'
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) =>
          router.replace(v === 'staff' ? pathname : `${pathname}?tab=${v}`, { scroll: false })
        }
        className="gap-4"
      >
        <div className="max-w-full overflow-x-auto">
          <TabsList className="group-data-horizontal/tabs:h-11">
            <TabsTrigger value="staff" className="min-h-9 px-4">
              Nhân viên
              {staff.data && (
                <span className="text-muted-foreground ml-1 tabular-nums">
                  ({staff.data.length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="min-h-9 px-4">
              Lịch tuần
            </TabsTrigger>
            <TabsTrigger value="days-off" className="min-h-9 px-4">
              Ngày nghỉ
            </TabsTrigger>
            <TabsTrigger value="hours" className="min-h-9 px-4">
              Giờ mở cửa
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="staff">
          <StaffListTab
            staff={staff.data}
            isLoading={staff.isLoading}
            error={staff.error}
            onRetry={() => void staff.refetch()}
          />
        </TabsContent>
        <TabsContent value="schedule">
          <WeeklyScheduleTab
            staff={staff.data}
            isLoading={staff.isLoading}
            error={staff.error}
            onRetry={() => void staff.refetch()}
          />
        </TabsContent>
        <TabsContent value="days-off">
          <DaysOffTab staff={staff.data} />
        </TabsContent>
        <TabsContent value="hours">
          <BusinessHoursTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
