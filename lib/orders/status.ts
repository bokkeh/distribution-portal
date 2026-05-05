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
