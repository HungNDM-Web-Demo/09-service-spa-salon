'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Package } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { CustomerPackagesTab } from '../components/CustomerPackagesTab'
import { TemplatesTab } from '../components/TemplatesTab'

/** Gói liệu trình (SCR-10): tab Gói của khách (customer-packages.view), Gói mẫu (packages.view); `?tab=` giữ tab đang xem. */
export function PackagesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { can } = usePermissions()
  const canCustomer = can(permissions.customerPackages.view)
  const canTemplates = can(permissions.packages.view)
  const requested = params.get('tab')
  const tab = requested === 'templates' && canTemplates ? 'templates' : canCustomer ? 'customer' : 'templates'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gói liệu trình"
        icon={Package}
        description="Bán gói nhiều buổi, theo dõi số buổi còn lại, hạn dùng; quản lý gói mẫu đang bán."
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === 'customer' ? pathname : `${pathname}?tab=${v}`, { scroll: false })}>
        <TabsList>
          {canCustomer && <TabsTrigger value="customer">Gói của khách</TabsTrigger>}
          {canTemplates && <TabsTrigger value="templates">Gói mẫu</TabsTrigger>}
        </TabsList>
        {canCustomer && (
          <TabsContent value="customer" className="mt-4">
            <CustomerPackagesTab />
          </TabsContent>
        )}
        {canTemplates && (
          <TabsContent value="templates" className="mt-4">
            <TemplatesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
