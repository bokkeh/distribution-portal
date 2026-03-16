import { TASTING_SMS_SEQUENCE } from '@/lib/tastings/sms-series'

export const TEXT_AUTOMATIONS = [
  ...TASTING_SMS_SEQUENCE.map((item) => ({
    id: `sms:${item.key}`,
    channel: 'SMS',
    audience: 'Tasters',
    name: item.label,
    trigger: item.description,
    destination: item.linkPath,
  })),
  {
    id: 'sms:delivery_completed',
    channel: 'SMS',
    audience: 'Customers',
    name: 'Delivery completed',
    trigger: 'Sent when a delivery stop is marked delivered.',
    destination: '/driver/deliveries',
  },
  {
    id: 'sms:driver_assignment',
    channel: 'SMS',
    audience: 'Drivers',
    name: 'Driver delivery assignment',
    trigger: 'Sent when a driver is assigned a new delivery run.',
    destination: '/driver/deliveries',
  },
] as const

export const EMAIL_AUTOMATIONS = [
  { id: 'email:invoice_created', channel: 'Email', audience: 'Customers', name: 'Invoice created', trigger: 'Sent when a new invoice is issued.', destination: '/customer/invoices' },
  { id: 'email:invoice_paid', channel: 'Email', audience: 'Customers', name: 'Invoice paid confirmation', trigger: 'Sent when an invoice payment is recorded.', destination: '/customer/invoices' },
  { id: 'email:order_received', channel: 'Email', audience: 'Customers', name: 'Order received', trigger: 'Sent when a customer submits an order.', destination: '/customer/orders' },
  { id: 'email:order_status', channel: 'Email', audience: 'Customers', name: 'Order status update', trigger: 'Sent when an order status changes.', destination: '/customer/orders' },
  { id: 'email:shipping_status', channel: 'Email', audience: 'Customers', name: 'Delivery status update', trigger: 'Sent when shipping or delivery status changes.', destination: '/customer/orders' },
  { id: 'email:delivery_completed', channel: 'Email', audience: 'Customers', name: 'Delivery completed', trigger: 'Sent when a delivery is marked complete.', destination: '/customer/orders' },
  { id: 'email:driver_assignment', channel: 'Email', audience: 'Drivers', name: 'Driver assignment', trigger: 'Sent when a driver is assigned a delivery route.', destination: '/driver/deliveries' },
  { id: 'email:taster_assignment', channel: 'Email', audience: 'Tasters', name: 'Tasting assignment', trigger: 'Sent when a taster is assigned to a tasting.', destination: '/taster/tastings' },
  { id: 'email:tasting_status', channel: 'Email', audience: 'Tasters', name: 'Tasting status update', trigger: 'Sent when a tasting is confirmed, cancelled, or declined.', destination: '/taster/tastings' },
  { id: 'email:tasting_report_received', channel: 'Email', audience: 'Tasters', name: 'Tasting report received', trigger: 'Sent when a tasting report is submitted.', destination: '/taster/tastings' },
  { id: 'email:taster_invoice', channel: 'Email', audience: 'Internal', name: 'Taster invoice submitted', trigger: 'Sent to accounting when a taster submits an invoice.', destination: '/admin/invoicing' },
  { id: 'email:wholesale_request', channel: 'Email', audience: 'Internal', name: 'Wholesale request received', trigger: 'Sent when a new wholesaler request is submitted.', destination: '/admin/wholesale-requests' },
  { id: 'email:internal_alert', channel: 'Email', audience: 'Staff/Admin', name: 'Internal alert', trigger: 'Used for tasting decline and operational alert workflows.', destination: '/admin/attention' },
] as const
