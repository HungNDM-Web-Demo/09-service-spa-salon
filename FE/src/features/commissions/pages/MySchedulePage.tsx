'use client'

import { useState } from 'react'
import { CalendarClock, HandCoins } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { vnToday } from '@/features/booking/lib/vn-time'
import { MyCommissionsPanel } from '../components/MyCommissionsPanel'
import { MyScheduleDay } from '../components/MyScheduleDay'
import { currentMonth } from '../lib/month'

/**
 * Lịch của tôi (SCR-13, UC-12; FR-33, NFR-06): KTV xem trên điện thoại lịch làm theo ngày và hoa hồng tháng của chính
 * mình. Ngày, tháng đang xem giữ ở trang để đổi tab không mất chỗ đang xem. Tab Hoa hồng cần `commissions.view-own`.
 */
export function MySchedulePage() {
  const { can } = usePermissions()
  const [tab, setTab] = useState('schedule')
  const [date, setDate] = useState(vnToday)
  const [month, setMonth] = useState(currentMonth)
  const showCommissions = can(permissions.commissions.viewOwn)

  return (
    <PermissionGuard permission={permissions.appointments.viewOwn} redirect>
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <PageHeader title="Lịch của tôi" icon={CalendarClock} description="Lịch làm theo ngày và hoa hồng tạm tính của bạn." />
        {showCommissions ? (
          <Tabs value={tab} onValueChange={setTab} className="gap-3">
            <TabsList className="w-full group-data-horizontal/tabs:h-11">
              <TabsTrigger value="schedule" className="text-[0.9375rem]">
                <CalendarClock aria-hidden="true" />
                Lịch làm
              </TabsTrigger>
              <TabsTrigger value="commissions" className="text-[0.9375rem]">
                <HandCoins aria-hidden="true" />
                Hoa hồng
              </TabsTrigger>
            </TabsList>
            <TabsContent value="schedule">
              <MyScheduleDay date={date} onDateChange={setDate} />
            </TabsContent>
            <TabsContent value="commissions">
              <MyCommissionsPanel month={month} onMonthChange={setMonth} />
            </TabsContent>
          </Tabs>
        ) : (
          <MyScheduleDay date={date} onDateChange={setDate} />
        )}
      </div>
    </PermissionGuard>
  )
}
