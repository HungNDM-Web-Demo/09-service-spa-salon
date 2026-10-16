import type { InvoiceDto, StoreProfileDto } from '@/types/spa'
import { formatPhone } from '@/lib/format'
import { paymentMethodLabels } from '@/features/booking/lib/labels'
import { ddmmyyyy, vnHhmmDate } from '@/features/booking/lib/vn-time'

const money = (v: number) => v.toLocaleString('vi-VN')

/**
 * Nội dung hóa đơn khổ 80 mm (UC-08 bước 8): thông tin tiệm, mã, giờ, khách, từng dịch vụ với KTV và giá,
 * dòng trừ buổi "Trừ gói GL…, còn N buổi, hạn dd/MM/yyyy", gói bán kèm, giảm giá, tổng, phương thức, tiền thối.
 */
export function InvoiceReceipt({ invoice: inv, store }: { invoice: InvoiceDto; store: StoreProfileDto | undefined }) {
  const services = inv.lines.filter((l) => l.kind === 'DichVu')
  const sales = inv.lines.filter((l) => l.kind === 'BanGoi')
  return (
    <div className="relative">
      {inv.status === 'DaHuy' && (
        <p className="absolute top-24 left-1/2 -translate-x-1/2 -rotate-12 rounded border-2 border-black px-3 py-1 text-lg font-bold tracking-widest opacity-70">
          ĐÃ HỦY
        </p>
      )}
      <div className="text-center">
        <p className="text-[15px] font-bold uppercase">{store?.name ?? ''}</p>
        {store?.address && <p>{store.address}</p>}
        {store?.hotline && <p>Hotline: {store.hotline}</p>}
      </div>
      <hr className="receipt-sep" />
      <p className="text-center text-[14px] font-bold">{sales.length > 0 && services.length === 0 ? 'HÓA ĐƠN BÁN GÓI' : 'HÓA ĐƠN DỊCH VỤ'}</p>
      <div className="mt-1 space-y-0.5">
        <Line left="Số:" right={inv.code} />
        <Line left="Ngày:" right={vnHhmmDate(inv.paidAt)} />
        {inv.appointmentCode && <Line left="Lịch hẹn:" right={inv.appointmentCode} />}
        <Line left="Thu ngân:" right={inv.cashierName} />
        <Line left="Khách:" right={inv.customer.fullName} />
        <Line left="SĐT:" right={formatPhone(inv.customer.phone)} />
      </div>
      <hr className="receipt-sep" />

      {services.map((l) => (
        <div key={l.id} className="mb-1.5">
          <Line left={<b>{l.description}</b>} right={l.usesPackage ? '0' : money(l.amount)} />
          <p>
            KTV {l.staffName} · {l.durationMinutes} phút
          </p>
          {l.usesPackage && (
            <p>
              Trừ gói {l.packageCode}, còn {l.packageRemaining} buổi
              {l.packageExpiryDate ? `, hạn ${ddmmyyyy(l.packageExpiryDate)}` : ''}
            </p>
          )}
        </div>
      ))}
      {sales.map((l) => (
        <div key={l.id} className="mb-1.5">
          <Line left={<b>{l.description}</b>} right={money(l.amount)} />
          <p>
            Mã gói {l.packageCode}
            {l.packageExpiryDate ? `, hạn ${ddmmyyyy(l.packageExpiryDate)}` : ''}
            {l.staffName ? ` · Tư vấn: ${l.staffName}` : ''}
          </p>
        </div>
      ))}

      <hr className="receipt-sep" />
      {inv.serviceTotal > 0 && <Line left="Dịch vụ lẻ" right={money(inv.serviceTotal)} />}
      {inv.packageTotal > 0 && <Line left="Gói liệu trình" right={money(inv.packageTotal)} />}
      {inv.discountAmount > 0 && (
        <>
          <Line left={`Giảm giá${inv.discountType === 'PhanTram' ? ` ${inv.discountValue}%` : ''}`} right={`-${money(inv.discountAmount)}`} />
          {inv.discountReason && <p className="text-[11.5px]">Lý do: {inv.discountReason}</p>}
        </>
      )}
      <div className="mt-1 flex justify-between text-[15px] font-bold">
        <span>TỔNG CỘNG</span>
        <span>{money(inv.total)} ₫</span>
      </div>
      <div className="mt-1 space-y-0.5">
        <Line left="Thanh toán:" right={paymentMethodLabels[inv.method]} />
        {inv.cashReceived !== null && <Line left="Tiền khách đưa:" right={money(inv.cashReceived)} />}
        {inv.changeAmount !== null && <Line left="Tiền thối:" right={money(inv.changeAmount)} />}
        {inv.cardAuthCode && <Line left="Mã chuẩn chi:" right={inv.cardAuthCode} />}
      </div>
      {inv.status === 'DaHuy' && (
        <>
          <hr className="receipt-sep" />
          <p>
            Đã hủy {inv.cancelledAt ? vnHhmmDate(inv.cancelledAt) : ''}
            {inv.cancelledByName ? ` bởi ${inv.cancelledByName}` : ''}
          </p>
          {inv.cancelReason && <p>Lý do: {inv.cancelReason}</p>}
        </>
      )}
      <hr className="receipt-sep" />
      <p className="text-center">Cảm ơn quý khách, hẹn gặp lại!</p>
    </div>
  )
}

function Line({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="min-w-0">{left}</span>
      <span className="shrink-0 text-right">{right}</span>
    </div>
  )
}
