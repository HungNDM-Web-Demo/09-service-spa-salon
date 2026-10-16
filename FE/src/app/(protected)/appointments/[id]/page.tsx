import type { Metadata } from 'next'
import { AppointmentDetailPage } from '@/features/appointments/pages/AppointmentDetailPage'

export const metadata: Metadata = { title: 'Chi tiết lịch hẹn' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AppointmentDetailPage key={id} id={id} />
}
