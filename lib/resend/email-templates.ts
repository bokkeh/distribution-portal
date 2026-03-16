import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { emailAutomationTemplates } from '@/db/schema'

export const EMAIL_AUTOMATION_DEFAULTS = [
  {
    key: 'invoice_created',
    label: 'Invoice created',
    description: 'Sent when a new invoice is issued.',
    audience: 'Customers',
    subjectTemplate: 'Invoice {{invoice_number}} from AHAWC',
    eyebrow: 'Invoice',
    titleTemplate: 'Invoice {{invoice_number}}',
    introTemplate: 'A new invoice is ready for {{company_name}}.',
    bodyTemplate: '<p style="margin: 0 0 12px;">Please review and pay the invoice below.</p><p style="margin: 0; font-size: 28px; font-weight: 700;">{{total_currency}}</p>',
    ctaLabel: 'View invoice',
    ctaPath: '/customer/invoices/{{invoice_id}}',
  },
  {
    key: 'invoice_paid',
    label: 'Invoice paid confirmation',
    description: 'Sent when an invoice payment is recorded.',
    audience: 'Customers',
    subjectTemplate: 'Payment received for {{invoice_number}}',
    eyebrow: 'Payment received',
    titleTemplate: 'Invoice paid',
    introTemplate: 'We received payment for {{company_name}}.',
    bodyTemplate: '<p style="margin: 0 0 12px;"><strong>Invoice:</strong> {{invoice_number}}</p><p style="margin: 0; font-size: 24px; font-weight: 700;">{{total_currency}}</p>',
    ctaLabel: 'View invoices',
    ctaPath: '/customer/invoices',
  },
  {
    key: 'order_received',
    label: 'Order received',
    description: 'Sent when a customer submits an order.',
    audience: 'Customers',
    subjectTemplate: 'Order received for {{company_name}}',
    eyebrow: 'Order update',
    titleTemplate: 'Order received',
    introTemplate: 'Your order for {{company_name}} has been received and is now being reviewed.',
    bodyTemplate: '<p style="margin: 0 0 12px;"><strong>Order:</strong> {{order_short_id}}</p><p style="margin: 0;"><strong>Total:</strong> {{total_currency}}</p>',
    ctaLabel: 'View order',
    ctaPath: '/customer/orders/{{order_id}}',
  },
  {
    key: 'order_status',
    label: 'Order status update',
    description: 'Sent when an order status changes.',
    audience: 'Customers',
    subjectTemplate: '{{status_title}} - {{company_name}}',
    eyebrow: 'Order status',
    titleTemplate: '{{status_title}}',
    introTemplate: '{{status_intro}}',
    bodyTemplate: '<p style="margin: 0;"><strong>Order:</strong> {{order_short_id}}</p>',
    ctaLabel: 'Open order',
    ctaPath: '/customer/orders/{{order_id}}',
  },
  {
    key: 'shipping_status',
    label: 'Delivery status update',
    description: 'Sent when shipping or delivery status changes.',
    audience: 'Customers',
    subjectTemplate: '{{shipping_title}} - {{company_name}}',
    eyebrow: 'Delivery update',
    titleTemplate: '{{shipping_title}}',
    introTemplate: '{{shipping_intro}}',
    bodyTemplate: '<p style="margin: 0;"><strong>Order:</strong> {{order_short_id}}</p>',
    ctaLabel: 'Track order',
    ctaPath: '/customer/orders/{{order_id}}',
  },
  {
    key: 'delivery_completed',
    label: 'Delivery completed',
    description: 'Sent when a delivery is marked complete.',
    audience: 'Customers',
    subjectTemplate: 'Delivery completed for {{company_name}}',
    eyebrow: 'Delivery completed',
    titleTemplate: 'Your delivery has been completed',
    introTemplate: 'Your delivery for {{company_name}} scheduled on {{delivery_date}} has been marked delivered.',
    bodyTemplate: '<p style="margin: 0 0 10px;"><strong>Account:</strong> {{company_name}}</p>{{proof_link_html}}{{shelf_link_html}}',
    ctaLabel: '',
    ctaPath: '',
  },
  {
    key: 'driver_assignment',
    label: 'Driver assignment',
    description: 'Sent when a driver is assigned a delivery route.',
    audience: 'Drivers',
    subjectTemplate: 'Delivery route assigned - {{week_start_date}}',
    eyebrow: 'Driver assignment',
    titleTemplate: 'New delivery route assigned',
    introTemplate: '{{driver_name}}, you have a delivery route scheduled for {{week_start_date}}.',
    bodyTemplate: '<p style="margin: 0;"><strong>Stops assigned:</strong> {{stop_count}}</p>',
    ctaLabel: 'Open driver portal',
    ctaPath: '/driver/deliveries',
  },
  {
    key: 'taster_assignment',
    label: 'Tasting assignment',
    description: 'Sent when a taster is assigned to a tasting.',
    audience: 'Tasters',
    subjectTemplate: 'Tasting assigned - {{store_name}}',
    eyebrow: 'Tasting assignment',
    titleTemplate: 'New tasting assigned',
    introTemplate: '{{taster_name}}, you have been assigned to {{store_name}}.',
    bodyTemplate: '<p style="margin: 0 0 10px;"><strong>When:</strong> {{scheduled_label}}</p><p style="margin: 0 0 10px;"><strong>Store:</strong> {{store_name}}</p>{{notes_html}}',
    ctaLabel: 'Review tasting',
    ctaPath: '/taster/tastings',
  },
  {
    key: 'tasting_status',
    label: 'Tasting status update',
    description: 'Sent when a tasting is confirmed, cancelled, or declined.',
    audience: 'Tasters',
    subjectTemplate: '{{status_title}} - {{store_name}}',
    eyebrow: 'Tasting update',
    titleTemplate: '{{status_title}}',
    introTemplate: '{{status_intro}}',
    bodyTemplate: '<p style="margin: 0;"><strong>Scheduled for:</strong> {{scheduled_at}}</p>',
    ctaLabel: '{{status_cta_label}}',
    ctaPath: '{{status_cta_path}}',
  },
  {
    key: 'tasting_report_received',
    label: 'Tasting report received',
    description: 'Sent when a tasting report is submitted.',
    audience: 'Tasters',
    subjectTemplate: 'Tasting report received - {{store_name}}',
    eyebrow: 'Report received',
    titleTemplate: 'Tasting report submitted',
    introTemplate: 'Thanks, {{taster_name}}. Your tasting report for {{store_name}} has been received.',
    bodyTemplate: '<p style="margin: 0;">You can return to the portal anytime to review your submitted activity and invoice status.</p>',
    ctaLabel: 'Open my tastings',
    ctaPath: '/taster/tastings',
  },
  {
    key: 'taster_invoice',
    label: 'Taster invoice submitted',
    description: 'Sent to accounting when a taster submits an invoice.',
    audience: 'Internal',
    subjectTemplate: 'Taster invoice submitted - {{payee_name}} - {{tasting_name}}',
    eyebrow: 'Taster invoice',
    titleTemplate: 'A taster invoice was submitted',
    introTemplate: '{{payee_name}} submitted an invoice for {{tasting_name}}.',
    bodyTemplate: '<p style="margin: 0 0 10px;"><strong>Email:</strong> {{payee_email}}</p><p style="margin: 0 0 10px;"><strong>Phone:</strong> {{payee_phone}}</p><p style="margin: 0 0 10px;"><strong>Date:</strong> {{tasting_date}}</p><p style="margin: 0 0 10px;"><strong>Location:</strong> {{store_address}}</p><p style="margin: 0 0 10px;"><strong>Hourly rate:</strong> {{hourly_rate_currency}}</p><p style="margin: 0 0 10px;"><strong>Hours worked:</strong> {{hours_worked}}</p><p style="margin: 0 0 10px;"><strong>Mileage:</strong> {{mileage}}</p><p style="margin: 0 0 10px;"><strong>Expenses:</strong> {{expense_amount_currency}}</p><p style="margin: 0 0 10px;"><strong>Total due:</strong> {{total_amount_currency}}</p>{{notes_html}}',
    ctaLabel: 'Open invoicing',
    ctaPath: '/admin/invoicing',
  },
  {
    key: 'wholesale_request',
    label: 'Wholesale request received',
    description: 'Sent when a new wholesaler request is submitted.',
    audience: 'Internal',
    subjectTemplate: 'Wholesale account request - {{business_name}}',
    eyebrow: 'Wholesale request',
    titleTemplate: 'New wholesale account request',
    introTemplate: 'A new request was submitted from the public marketing form.',
    bodyTemplate: '<p style="margin: 0 0 10px;"><strong>Business:</strong> {{business_name}}</p><p style="margin: 0 0 10px;"><strong>Email:</strong> {{business_email}}</p><p style="margin: 0 0 10px;"><strong>Phone:</strong> {{phone}}</p><p style="margin: 0 0 10px;"><strong>Normalized:</strong> {{phone_normalized}}</p><p style="margin: 0;"><strong>SMS opt-in:</strong> {{sms_opt_in}}</p>',
    ctaLabel: 'Open requests',
    ctaPath: '/admin/wholesale-requests',
  },
  {
    key: 'internal_alert',
    label: 'Internal alert',
    description: 'Used for tasting decline and operational alert workflows.',
    audience: 'Staff/Admin',
    subjectTemplate: '{{subject}}',
    eyebrow: 'Internal alert',
    titleTemplate: '{{title}}',
    introTemplate: '{{body}}',
    bodyTemplate: '<p style="margin: 0;">Review the update in the portal.</p>',
    ctaLabel: 'Open portal',
    ctaPath: '{{href}}',
  },
] as const

export type EmailAutomationTemplateKey = typeof EMAIL_AUTOMATION_DEFAULTS[number]['key']

export async function upsertDefaultEmailAutomationTemplates() {
  try {
    const existing = await db
      .select({ key: emailAutomationTemplates.key })
      .from(emailAutomationTemplates)

    const existingKeys = new Set(existing.map((row) => row.key))

    for (let index = 0; index < EMAIL_AUTOMATION_DEFAULTS.length; index += 1) {
      const template = EMAIL_AUTOMATION_DEFAULTS[index]
      if (existingKeys.has(template.key)) continue

      await db.insert(emailAutomationTemplates).values({
        ...template,
        sortOrder: index,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (!message.includes('email_automation_templates') && !message.includes('does not exist')) {
      throw error
    }
  }
}

export async function getEmailAutomationTemplates() {
  try {
    const rows = await db
      .select()
      .from(emailAutomationTemplates)
      .orderBy(asc(emailAutomationTemplates.sortOrder), asc(emailAutomationTemplates.label))

    if (rows.length) return rows
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    if (!message.includes('email_automation_templates') && !message.includes('does not exist')) {
      throw error
    }
  }

  return EMAIL_AUTOMATION_DEFAULTS.map((template, index) => ({
    id: `default-${template.key}`,
    key: template.key,
    label: template.label,
    description: template.description,
    audience: template.audience,
    sortOrder: index,
    subjectTemplate: template.subjectTemplate,
    eyebrow: template.eyebrow,
    titleTemplate: template.titleTemplate,
    introTemplate: template.introTemplate ?? null,
    bodyTemplate: template.bodyTemplate,
    ctaLabel: template.ctaLabel || null,
    ctaPath: template.ctaPath || null,
    updatedAt: new Date(),
    createdAt: new Date(),
  }))
}

export async function getEmailAutomationTemplateMap() {
  const templates = await getEmailAutomationTemplates()
  return new Map(templates.map((template) => [template.key, template]))
}

export function resolveDefaultEmailTemplate(key: EmailAutomationTemplateKey) {
  return EMAIL_AUTOMATION_DEFAULTS.find((template) => template.key === key)!
}
