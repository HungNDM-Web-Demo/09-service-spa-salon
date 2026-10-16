'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { routePath } from '@/config/route-path'
import './receipt.css'

type ReceiptFrameProps = {
  /** Tự gọi window.print() khi mở từ luồng thanh toán (?print=1) */
  autoPrint: boolean
  ready: boolean
  /** Nơi quay về khi không có lịch sử (mở thẳng link) */
  backHref?: string
  children: React.ReactNode
}

/** Khung trang in: thanh công cụ (ẩn khi in) + tờ giấy 80 mm căn giữa. Chép từ demo POS cà phê. */
export function ReceiptFrame({ autoPrint, ready, backHref = routePath.appointments, children }: ReceiptFrameProps) {
  const router = useRouter()
  const printed = useRef(false)

  useEffect(() => {
    if (!autoPrint || !ready || printed.current) return
    printed.current = true
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [autoPrint, ready])

  return (
    <div className="bg-muted min-h-svh print:bg-white">
      <div className="print-hidden bg-card sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4">
        <Button variant="outline" onClick={() => (window.history.length > 1 ? router.back() : router.push(backHref))}>
          <ArrowLeft aria-hidden="true" />
          Quay lại
        </Button>
        <span className="flex-1" />
        <Button variant="cta" onClick={() => window.print()} disabled={!ready}>
          <Printer aria-hidden="true" />
          In
        </Button>
      </div>
      <div className="flex justify-center px-4 py-6 print:p-0">
        <div className="receipt rounded-sm px-3 py-4 shadow-md print:rounded-none print:p-0 print:shadow-none">{children}</div>
      </div>
    </div>
  )
}
