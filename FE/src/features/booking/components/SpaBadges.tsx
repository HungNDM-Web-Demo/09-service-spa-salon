import { AlertTriangle } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import type { AppointmentStatus, CommissionPeriodStatus, CustomerPackageStatus, InvoiceStatus } from '@/types/spa'
import { appointmentStatusLabels, invoiceStatusLabels, packageStatusLabels, periodStatusLabels } from '../lib/labels'

export function AppointmentStatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const item = appointmentStatusLabels[status]
  return (
    <StatusBadge tone={item.tone} className={className}>
      {item.label}
    </StatusBadge>
  )
}

export function PackageStatusBadge({ status }: { status: CustomerPackageStatus }) {
  const item = packageStatusLabels[status]
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const item = invoiceStatusLabels[status]
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
}

export function PeriodStatusBadge({ status }: { status: CommissionPeriodStatus }) {
  const item = periodStatusLabels[status]
  return <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
}

/** Nhãn "Hay bỏ hẹn" (BR-13) */
export function FlaggedBadge({ count }: { count?: number }) {
  return (
    <StatusBadge tone="warning" icon={<AlertTriangle className="size-3" aria-hidden="true" />}>
      Hay bỏ hẹn{count !== undefined ? ` (${count} lần/90 ngày)` : ''}
    </StatusBadge>
  )
}
