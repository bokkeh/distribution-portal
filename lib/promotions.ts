export const PROMOTION_CATEGORY_LABELS: Record<string, string> = {
  social_post: 'Social Post',
  in_store_signage: 'In-Store Signage',
  menu_feature: 'Menu Feature',
  bar_sign: 'Bar Sign',
  restaurant_signage: 'Restaurant Signage',
  window_cling: 'Window Cling',
  shelf_talker: 'Shelf Talker',
  barker_card: 'Barker Card',
  other: 'Other',
}

export const PROMOTION_ORDER_STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  in_production: 'In Production',
  ready_for_delivery: 'Ready for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function formatPromotionCategory(category: string | null | undefined) {
  if (!category) return 'Other'
  return PROMOTION_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatPromotionOrderStatus(status: string | null | undefined) {
  if (!status) return 'Unknown'
  return PROMOTION_ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function promotionStatusBadgeVariant(status: string) {
  switch (status) {
    case 'requested':
      return 'warning' as const
    case 'approved':
    case 'ready_for_delivery':
      return 'info' as const
    case 'in_production':
      return 'secondary' as const
    case 'delivered':
    case 'completed':
      return 'success' as const
    case 'cancelled':
      return 'destructive' as const
    default:
      return 'outline' as const
  }
}
