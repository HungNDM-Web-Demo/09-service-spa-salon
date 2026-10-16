'use client'

import Link from 'next/link'
import { MapPin, Phone } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { routePath } from '@/config/route-path'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { usePublicCatalog } from '@/features/booking/hooks/use-spa'

/** Khung trang công khai cho khách (SCR-07, SCR-08): logo, tên, địa chỉ, hotline của tiệm; tối ưu 375 px. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const catalog = usePublicCatalog()
  const shop = catalog.data?.shop
  const logo = useAssetUrl(shop?.logoUrl ?? '/logo/logo-mark.svg')

  return (
    <div className="bg-background min-h-svh">
      <header className="bg-card border-b">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link href={routePath.booking} className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo do tiệm tự tải lên */}
            <img src={logo ?? undefined} alt="" className="size-11 shrink-0 rounded-xl object-contain" />
            <div className="min-w-0">
              {shop ? (
                <p className="truncate font-semibold">{shop.name}</p>
              ) : (
                <Skeleton className="h-5 w-40" />
              )}
              {shop?.address && (
                <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                  <MapPin className="size-3 shrink-0" aria-hidden="true" />
                  {shop.address}
                </p>
              )}
            </div>
          </Link>
          {shop?.hotline && (
            <a
              href={`tel:${shop.hotline.replace(/\s/g, '')}`}
              className="text-primary ml-auto flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium"
            >
              <Phone className="size-3.5" aria-hidden="true" />
              Gọi tiệm
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-4 pb-28">{children}</main>
    </div>
  )
}
