export const orderStatusVariant: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  pending: 'warning',
  confirmed: 'info',
  fulfilled: 'success',
  cancelled: 'destructive',
}

export const shippingStatusVariant: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  not_scheduled: 'secondary',
  scheduled: 'info',
  out_for_delivery: 'warning',
  delivered: 'success',
  issue: 'destructive',
}

export const orderPaymentStatusVariant: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info'> = {
  not_applicable: 'secondary',
  unpaid: 'warning',
  requires_action: 'warning',
  processing: 'info',
  paid: 'success',
  failed: 'destructive',
  canceled: 'destructive',
}

export function formatStatusLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export function formatOrderPaymentStatusLabel(value: string) {
  if (value === 'not_applicable') return 'n/a'
  return formatStatusLabel(value)
}

export function formatOrderTypeLabel(value: string) {
  if (value === 'paid') return 'Standard order'
  if (value === 'sample') return 'Sample order'
  return formatStatusLabel(value)
}

export function formatOrderPaymentMethodLabel(value: string | null | undefined) {
  if (value === 'cod') return 'COD'
  if (value === 'check') return 'Check'
  if (value === 'stripe') return 'Stripe'
  if (value === 'manual') return 'Manual'
  return 'Not selected'
}

export function getOrderPaymentType(paymentStatus: string, paymentMethod: string | null | undefined) {
  if (paymentStatus === 'paid') return 'paid' as const
  if (paymentMethod === 'check') return 'check' as const
  if (paymentMethod === 'cod') return 'cod' as const
  return 'unpaid' as const
}
