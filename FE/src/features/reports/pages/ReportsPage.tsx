'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { CancellationsTab } from '../components/CancellationsTab'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { PackagesTab } from '../components/PackagesTab'
import { RevenueTab } from '../components/RevenueTab'
import { ServicesTab } from '../components/ServicesTab'
import { TechniciansTab } from '../components/TechniciansTab'
import { DEFAULT_PRESET, presetRange, type DateRange, type RangePreset } from '../lib/date-range'

const TABS = [
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'services', label: 'Dịch vụ' },
  { value: 'technicians', label: 'Kỹ thuật viên' },
  { value: 'packages', label: 'Gói liệu trình' },
  { value: 'cancellations', label: 'Hủy và không đến' },
] as const
type TabValue = (typeof TABS)[number]['value']
const DEFAULT_TAB: TabValue = 'revenue'
const isTab = (v: string | null): v is TabValue => TABS.some((t) => t.value === v)

/**
 * Báo cáo (SCR-15, UC-15; FR-36…FR-38): mặc định tab Doanh thu, 30 ngày gần nhất; tab đồng bộ `?tab=`. Khoảng ngày dùng
 * chung cho mọi tab, chặn khoảng quá 366 ngày trước khi gọi API. Mỗi tab xuất Excel đúng bảng đang xem.
 * Tab không mở thì không gắn vào cây (Radix bỏ nội dung tab ẩn), nên chỉ tab đang xem gọi API.
 */
export function ReportsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tabParam = params.get('tab')
  const tab: TabValue = isTab(tabParam) ? tabParam : DEFAULT_TAB
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET)
  const [range, setRange] = useState<DateRange>(() => presetRange(DEFAULT_PRESET))

  const setTab = (value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value === DEFAULT_TAB) next.delete('tab')
    else next.set('tab', value)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <PermissionGuard permission={permissions.reports.view} redirect>
      <div className="space-y-5">
        <PageHeader
          title="Báo cáo"
          icon={BarChart3}
          description="Thực thu, giá trị dịch vụ đã làm, dịch vụ, kỹ thuật viên, gói liệu trình và tỉ lệ hủy lịch theo khoảng ngày."
        />
        <DateRangeFilter
          preset={preset}
          value={range}
          onChange={(p, r) => {
            setPreset(p)
            setRange(r)
          }}
        />
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <div className="-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-1">
            <TabsList className="w-max group-data-horizontal/tabs:h-10">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="min-h-8 px-4">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="revenue">
            <RevenueTab range={range} />
          </TabsContent>
          <TabsContent value="services">
            <ServicesTab range={range} />
          </TabsContent>
          <TabsContent value="technicians">
            <TechniciansTab range={range} />
          </TabsContent>
          <TabsContent value="packages">
            <PackagesTab range={range} />
          </TabsContent>
          <TabsContent value="cancellations">
            <CancellationsTab range={range} />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
