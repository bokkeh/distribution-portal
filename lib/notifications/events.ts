import type { NotificationChannel } from './types'

// ---------------------------------------------------------------------------
// Per-event payload types
// ---------------------------------------------------------------------------

export interface OrderReceivedPayload {
  companyName: string
  orderId: string
  total: string
  purchaseUnit: string
  placedBy: string
  customerEmails: string[]
  staffPhones?: string[]
  userId?: string | null
}

export interface OrderStatusChangedPayload {
  companyName: string
  orderId: string
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
  customerEmails: string[]
  userId?: string | null
}

export interface OrderShippingStatusChangedPayload {
  companyName: string
  orderId: string
  status: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
  customerEmails: string[]
  customerPhone?: string | null
  userId?: string | null
}

export interface InvoiceCreatedPayload {
  companyName: string
  invoiceNumber: string
  total: string
  invoiceUrl: string
  customerEmail: string
  userId?: string | null
}

export interface InvoicePaidPayload {
  companyName: string
  invoiceNumber: string
  total: string
  notifyEmails: string[]
  userId?: string | null
}

export interface DeliveryCompletedPayload {
  companyName: string
  deliveryDate: string
  deliveryId: string
  customerEmail: string | null
  customerPhone?: string | null
  proofOfDeliveryUrl?: string | null
  shelfPhotoUrl?: string | null
  userId?: string | null
}

export interface DeliveryRunCompletedPayload {
  deliveryId: string
  deliveryUrl: string
}

export interface TastingTasterDeclinedPayload {
  tastingId: string
  eventName: string
  scheduledAt: Date
  declinedByName: string
  teamPhones: Array<{ phone: string; userId: string }>
  teamEmails: string[]
}

export interface DeliveryDriverAssignedPayload {
  driverName: string
  driverEmail: string
  driverPhone?: string | null
  weekStartDate: string
  stopCount: number
  userId?: string | null
}

export interface WholesaleRequestReceivedPayload {
  businessName: string
  businessEmail: string
  businessType?: string | null
  phone: string | null
  phoneNormalized: string | null
  smsOptIn: boolean
  adminUserIds?: string[]
}

export interface TastingTasterAssignedPayload {
  tasterName: string
  tasterEmail: string
  tasterPhone?: string | null
  storeName: string
  storeAddress: string
  scheduledAt: Date
  endAt?: Date | null
  notes?: string | null
  tastingId: string
  userId?: string | null
}

export interface TastingStatusChangedPayload {
  tasterEmail: string
  tasterPhone?: string | null
  storeName: string
  storeAddress?: string
  status: 'confirmed' | 'cancelled' | 'declined'
  scheduledAt: Date
  endAt?: Date | null
  tastingId: string
  userId?: string | null
}

export interface TastingReportReceivedPayload {
  tasterName: string
  tasterEmail: string
  storeName: string
  tastingId: string
  userId?: string | null
}

export interface UserWelcomedPayload {
  name: string
  email: string
  password: string
  role: string
}

// ---------------------------------------------------------------------------
// Event map — ties event names to their payload types
// ---------------------------------------------------------------------------

export interface NotificationEventPayloads {
  'order.received': OrderReceivedPayload
  'order.status_changed': OrderStatusChangedPayload
  'order.shipping_status_changed': OrderShippingStatusChangedPayload
  'invoice.created': InvoiceCreatedPayload
  'invoice.paid': InvoicePaidPayload
  'delivery.completed': DeliveryCompletedPayload
  'delivery.run_completed': DeliveryRunCompletedPayload
  'delivery.driver_assigned': DeliveryDriverAssignedPayload
  'wholesale_request.received': WholesaleRequestReceivedPayload
  'tasting.taster_assigned': TastingTasterAssignedPayload
  'tasting.status_changed': TastingStatusChangedPayload
  'tasting.report_received': TastingReportReceivedPayload
  'tasting.taster_declined': TastingTasterDeclinedPayload
  'user.welcomed': UserWelcomedPayload
}

export type NotificationEvent = keyof NotificationEventPayloads

// ---------------------------------------------------------------------------
// Channel registry — which channels fire for each event
// ---------------------------------------------------------------------------

export const EVENT_CHANNELS: Record<NotificationEvent, NotificationChannel[]> = {
  'order.received':                ['email', 'sms', 'chat', 'in-app'],
  'order.status_changed':          ['email', 'in-app'],
  'order.shipping_status_changed': ['email', 'sms', 'in-app'],
  'invoice.created':               ['email'],
  'invoice.paid':                  ['email', 'in-app'],
  'delivery.completed':            ['email', 'sms', 'in-app'],
  'delivery.run_completed':        ['sms', 'chat', 'in-app'],
  'delivery.driver_assigned':      ['email', 'sms', 'in-app'],
  'wholesale_request.received':    ['email', 'chat', 'in-app'],
  'tasting.taster_assigned':       ['email', 'sms', 'in-app'],
  'tasting.status_changed':        ['email', 'sms'],
  'tasting.report_received':       ['email'],
  'tasting.taster_declined':       ['email', 'sms', 'in-app'],
  'user.welcomed':                 ['email'],
}
