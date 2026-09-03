import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatOrderPaymentStatusLabel, formatStatusLabel } from '@/lib/orders/status'

type OrderStatusKind = 'order' | 'payment' | 'shipping'

type StatusTone = 'active' | 'warning' | 'success' | 'inactive' | 'danger'

const statusTones: Record<OrderStatusKind, Record<string, StatusTone>> = {
  order: {
    pending: 'active',
    confirmed: 'warning',
    fulfilled: 'success',
    cancelled: 'danger',
  },
  payment: {
    not_applicable: 'inactive',
    unpaid: 'warning',
    requires_action: 'warning',
    processing: 'active',
    paid: 'success',
    failed: 'danger',
    canceled: 'danger',
  },
  shipping: {
    not_scheduled: 'inactive',
    scheduled: 'warning',
    out_for_delivery: 'active',
    delivered: 'success',
    issue: 'danger',
  },
}

const toneClasses: Record<StatusTone, string> = {
  active: 'border-[#ff4f00] bg-[#ff4f00] text-white hover:bg-[#e64700]',
  warning: 'border-[#ff4f00] bg-[#fff7f2] text-[#d94300] hover:bg-[#fff0e6]',
  success: 'border-[#00ad72] bg-[#ecfff7] text-[#00875a] hover:bg-[#ddfaee]',
  inactive: 'border-[#181615] bg-[#181615] text-white hover:bg-[#302d2b]',
  danger: 'border-[#ef3340] bg-[#ef3340] text-white hover:bg-[#d92b37]',
}

interface OrderStatusBadgeProps {
  kind: OrderStatusKind
  status: string
  className?: string
}

export function OrderStatusBadge({ kind, status, className }: OrderStatusBadgeProps) {
  const tone = statusTones[kind][status] ?? 'inactive'
  const label = kind === 'payment'
    ? formatOrderPaymentStatusLabel(status)
    : formatStatusLabel(status)

  return (
    <Badge
      variant="outline"
      className={cn(
        'min-h-6 whitespace-nowrap rounded-[4px] px-2 py-1 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.04em] shadow-none',
        toneClasses[tone],
        className,
      )}
    >
      {label}
    </Badge>
  )
}
