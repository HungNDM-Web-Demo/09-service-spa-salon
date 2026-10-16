'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { useServiceGroups } from '@/features/booking/hooks/use-spa'
import { ServiceGroupsTab } from '../components/ServiceGroupsTab'
import { ServicesTab } from '../components/ServicesTab'

/** Dịch vụ (SCR-09; UC-01, FR-03): tab Dịch vụ, Nhóm dịch vụ, đồng bộ `?tab=groups`. Lễ tân chỉ xem. */
export function ServicesPage() {
  return (
    <PermissionGuard permission={permissions.services.view} redirect>
      <ServicesView />
    </PermissionGuard>
  )
}

function ServicesView() {
  const { canAny } = usePermissions()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tab = params.get('tab') === 'groups' ? 'groups' : 'services'
  const groups = useServiceGroups()
  const readOnly = !canAny([
    permissions.services.create,
    permissions.services.update,
    permissions.services.delete,
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dịch vụ"
        icon={Sparkles}
        description={
          readOnly
            ? 'Bảng giá, thời lượng và mức hoa hồng của từng dịch vụ. Chỉ chủ tiệm sửa được danh mục.'
            : 'Thêm, sửa, ẩn dịch vụ; bảng giá, thời lượng, mức hoa hồng và cho đặt online.'
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) =>
          router.replace(v === 'groups' ? `${pathname}?tab=groups` : pathname, { scroll: false })
        }
        className="gap-4"
      >
        <TabsList className="group-data-horizontal/tabs:h-11">
          <TabsTrigger value="services" className="min-h-9 px-4">
            Dịch vụ
          </TabsTrigger>
          <TabsTrigger value="groups" className="min-h-9 px-4">
            Nhóm dịch vụ
            {groups.data && (
              <span className="text-muted-foreground ml-1 tabular-nums">
                ({groups.data.length})
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="services">
          <ServicesTab groups={groups.data} />
        </TabsContent>
        <TabsContent value="groups">
          <ServiceGroupsTab
            groups={groups.data}
            isLoading={groups.isLoading}
            error={groups.error}
            onRetry={() => void groups.refetch()}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
