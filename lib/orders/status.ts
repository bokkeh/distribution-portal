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

export function formatStatusLabel(value: string) {
  return value.replace(/_/g, ' ')
}
