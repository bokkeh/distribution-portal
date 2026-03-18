import { db } from '@/db'
import { notificationsLog } from '@/db/schema'
import { formatEasternDateTime, formatEasternTimeRange } from '@/lib/tastings/time'
import {
  getEmailAutomationTemplateMap,
  resolveDefaultEmailTemplate,
  upsertDefaultEmailAutomationTemplates,
  type EmailAutomationTemplateKey,
} from '@/lib/resend/email-templates'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY ?? 're_placeholder')

function portalUrl(path: string) {
  const base = process.env.NEXTAUTH_URL ?? 'https://portal.ahawc.com'
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
    template,
  )
}

function formatCurrencyValue(value: string | number) {
  const amount = typeof value === 'number' ? value : Number.parseFloat(value || '0')
  return `$${amount.toFixed(2)}`
}

function renderEmailCard({
  eyebrow,
  title,
  intro,
  body,
  ctaLabel,
  ctaHref,
}: {
  eyebrow: string
  title: string
  intro?: string
  body: string
  ctaLabel?: string
  ctaHref?: string
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
      <div style="background: #0f172a; padding: 24px; border-radius: 10px 10px 0 0;">
        <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #93c5fd; margin-bottom: 8px;">${eyebrow}</div>
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${title}</h1>
      </div>
      <div style="background: #f8fafc; padding: 28px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
        ${intro ? `<p style="margin: 0 0 18px; color: #475569; font-size: 15px;">${intro}</p>` : ''}
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; color: #1e293b; line-height: 1.55;">
          ${body}
        </div>
        ${ctaLabel && ctaHref ? `<a href="${ctaHref}" style="display: inline-block; margin-top: 20px; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600;">${ctaLabel}</a>` : ''}
        <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0;">AHAWC Distribution Portal</p>
      </div>
    </div>
  `
}

async function logEmailNotification({
  userId,
  recipient,
  recipientName,
  message,
  status,
}: {
  userId?: string | null
  recipient: string
  recipientName?: string | null
  message: string
  status: 'sent' | 'failed'
}) {
  try {
    await db.insert(notificationsLog).values({
      userId: userId ?? null,
      recipientPhone: recipient,
      recipientName: recipientName ?? null,
      type: 'email',
      message,
      status,
    })
  } catch {}
}

async function sendEmail({
  to,
  subject,
  html,
  userId,
  recipientName,
}: {
  to: string | string[]
  subject: string
  html: string
  userId?: string | null
  recipientName?: string | null
}) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean)
  if (!recipients.length) return

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@ahawc.com',
      to: recipients,
      subject,
      html,
    })

    await Promise.all(recipients.map((recipient) =>
      logEmailNotification({
        userId,
        recipient,
        recipientName,
        message: subject,
        status: 'sent',
      }),
    ))
  } catch (error) {
    console.error('Resend email failed:', error)

    await Promise.all(recipients.map((recipient) =>
      logEmailNotification({
        userId,
        recipient,
        recipientName,
        message: subject,
        status: 'failed',
      }),
    ))
  }
}

async function sendAutomationEmail({
  key,
  to,
  recipientName,
  variables,
  userId,
}: {
  key: EmailAutomationTemplateKey
  to: string | string[]
  recipientName?: string | null
  variables: Record<string, string>
  userId?: string | null
}) {
  await upsertDefaultEmailAutomationTemplates()
  const templateMap = await getEmailAutomationTemplateMap()
  const template = templateMap.get(key) ?? resolveDefaultEmailTemplate(key)

  const ctaPath = template.ctaPath ? renderTemplate(template.ctaPath, variables).trim() : ''
  const ctaHref = ctaPath
    ? (ctaPath.startsWith('http://') || ctaPath.startsWith('https://') ? ctaPath : portalUrl(ctaPath))
    : undefined
  const ctaLabel = template.ctaLabel ? renderTemplate(template.ctaLabel, variables).trim() : ''

  await sendEmail({
    to,
    recipientName,
    userId,
    subject: renderTemplate(template.subjectTemplate, variables),
    html: renderEmailCard({
      eyebrow: renderTemplate(template.eyebrow, variables),
      title: renderTemplate(template.titleTemplate, variables),
      intro: template.introTemplate ? renderTemplate(template.introTemplate, variables) : undefined,
      body: renderTemplate(template.bodyTemplate, variables),
      ctaLabel: ctaLabel || undefined,
      ctaHref,
    }),
  })
}

export async function sendInvoiceEmailNotification({
  to,
  invoiceNumber,
  companyName,
  total,
  invoiceUrl,
}: {
  to: string
  invoiceNumber: string
  companyName: string
  total: string
  invoiceUrl: string
}): Promise<void> {
  await sendAutomationEmail({
    key: 'invoice_created',
    to,
    recipientName: companyName,
    variables: {
      invoice_number: escapeHtml(invoiceNumber),
      company_name: escapeHtml(companyName),
      total_currency: formatCurrencyValue(total),
      invoice_id: invoiceUrl.split('/').pop() ?? '',
    },
  })
}

export async function sendInvoicePaidConfirmationEmail({
  to,
  companyName,
  invoiceNumber,
  total,
}: {
  to: string[]
  companyName: string
  invoiceNumber: string
  total: string
}) {
  await sendAutomationEmail({
    key: 'invoice_paid',
    to,
    recipientName: companyName,
    variables: {
      invoice_number: escapeHtml(invoiceNumber),
      company_name: escapeHtml(companyName),
      total_currency: formatCurrencyValue(total),
    },
  })
}

export async function sendOrderReceivedEmail({
  to,
  companyName,
  orderId,
  total,
}: {
  to: string[]
  companyName: string
  orderId: string
  total: string
}) {
  await sendAutomationEmail({
    key: 'order_received',
    to,
    recipientName: companyName,
    variables: {
      company_name: escapeHtml(companyName),
      order_id: orderId,
      order_short_id: escapeHtml(orderId.slice(-8).toUpperCase()),
      total_currency: formatCurrencyValue(total),
    },
  })
}

export async function sendOrderStatusEmail({
  to,
  companyName,
  orderId,
  status,
}: {
  to: string[]
  companyName: string
  orderId: string
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
}) {
  const copy = {
    pending: {
      title: 'Order pending review',
      intro: `Your order for ${companyName} is pending review.`,
    },
    confirmed: {
      title: 'Order confirmed',
      intro: `Your order for ${companyName} has been confirmed.`,
    },
    fulfilled: {
      title: 'Order complete',
      intro: `Your order for ${companyName} has been completed.`,
    },
    cancelled: {
      title: 'Order cancelled',
      intro: `Your order for ${companyName} has been cancelled.`,
    },
  }[status]

  await sendAutomationEmail({
    key: 'order_status',
    to,
    recipientName: companyName,
    variables: {
      company_name: escapeHtml(companyName),
      order_id: orderId,
      order_short_id: escapeHtml(orderId.slice(-8).toUpperCase()),
      status_title: escapeHtml(copy.title),
      status_intro: escapeHtml(copy.intro),
    },
  })
}

export async function sendOrderShippingStatusEmail({
  to,
  companyName,
  orderId,
  status,
}: {
  to: string[]
  companyName: string
  orderId: string
  status: 'not_scheduled' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'issue'
}) {
  const copy = {
    not_scheduled: {
      title: 'Delivery not yet scheduled',
      intro: `Your order for ${companyName} is awaiting delivery scheduling.`,
    },
    scheduled: {
      title: 'Delivery scheduled',
      intro: `Your order for ${companyName} has been scheduled for delivery.`,
    },
    out_for_delivery: {
      title: 'Order out for delivery',
      intro: `Your order for ${companyName} is currently out for delivery.`,
    },
    delivered: {
      title: 'Order delivered',
      intro: `Your order for ${companyName} has been delivered.`,
    },
    issue: {
      title: 'Delivery issue',
      intro: `There is an issue affecting delivery for ${companyName}.`,
    },
  }[status]

  await sendAutomationEmail({
    key: 'shipping_status',
    to,
    recipientName: companyName,
    variables: {
      company_name: escapeHtml(companyName),
      order_id: orderId,
      order_short_id: escapeHtml(orderId.slice(-8).toUpperCase()),
      shipping_title: escapeHtml(copy.title),
      shipping_intro: escapeHtml(copy.intro),
    },
  })
}

export async function sendSampleCaseAlert({
  staffName,
  productName,
  sku,
  previousQty,
  newQty,
  delta,
}: {
  staffName: string
  productName: string
  sku: string
  previousQty: number
  newQty: number
  delta: number
}): Promise<void> {
  const direction = delta > 0 ? `+${delta}` : String(delta)
  const action = delta > 0 ? 'added' : 'removed'

  await sendEmail({
    to: process.env.SAMPLE_CASE_ALERT_EMAIL ?? 'kris@ahawc.com',
    recipientName: 'Inventory team',
    subject: `Sample case adjustment - ${productName}`,
    html: renderEmailCard({
      eyebrow: 'Inventory alert',
      title: 'Sample case adjustment',
      intro: `${escapeHtml(staffName)} ${action} sample cases for ${escapeHtml(productName)}.`,
      body: `
        <p style="margin: 0 0 10px;"><strong>SKU:</strong> ${escapeHtml(sku)}</p>
        <p style="margin: 0 0 10px;"><strong>Previous quantity:</strong> ${previousQty}</p>
        <p style="margin: 0 0 10px;"><strong>Adjustment:</strong> ${direction}</p>
        <p style="margin: 0;"><strong>New quantity:</strong> ${newQty}</p>
      `,
    }),
  })
}

export async function sendWelcomeEmail({
  to,
  name,
  password,
  role,
}: {
  to: string
  name: string
  password: string
  role: string
}): Promise<void> {
  await sendEmail({
    to,
    recipientName: name,
    subject: 'Welcome to AHAWC Distribution Portal',
    html: renderEmailCard({
      eyebrow: 'Welcome',
      title: `Welcome to AHAWC, ${escapeHtml(name)}`,
      intro: 'Your account is ready.',
      body: `
        <p style="margin: 0 0 10px;"><strong>Email:</strong> ${escapeHtml(to)}</p>
        <p style="margin: 0 0 10px;"><strong>Temporary password:</strong> ${escapeHtml(password)}</p>
        <p style="margin: 0;"><strong>Role:</strong> ${escapeHtml(role)}</p>
      `,
      ctaLabel: 'Log in',
      ctaHref: portalUrl('/login'),
    }),
  })
}

export async function sendWholesaleRequestNotification({
  businessName,
  businessEmail,
  businessType,
  phone,
  phoneNormalized,
  smsOptIn,
}: {
  businessName: string
  businessEmail: string
  businessType?: string | null
  phone: string | null
  phoneNormalized: string | null
  smsOptIn: boolean
}): Promise<void> {
  await sendAutomationEmail({
    key: 'wholesale_request',
    to: process.env.WHOLESALE_REQUEST_NOTIFICATION_EMAIL ?? 'admin@ahawc.com',
    recipientName: businessName,
    variables: {
      business_name: escapeHtml(businessName),
      business_email: escapeHtml(businessEmail),
      business_type: escapeHtml(businessType ?? '-'),
      phone: escapeHtml(phone ?? '-'),
      phone_normalized: escapeHtml(phoneNormalized ?? '-'),
      sms_opt_in: smsOptIn ? 'Yes' : 'No',
    },
  })
}

export async function sendDeliveryCompletedEmail({
  to,
  companyName,
  deliveryDate,
  proofOfDeliveryUrl,
  shelfPhotoUrl,
}: {
  to: string
  companyName: string
  deliveryDate: string
  proofOfDeliveryUrl?: string | null
  shelfPhotoUrl?: string | null
}): Promise<void> {
  await sendAutomationEmail({
    key: 'delivery_completed',
    to,
    recipientName: companyName,
    variables: {
      company_name: escapeHtml(companyName),
      delivery_date: escapeHtml(deliveryDate),
      proof_link_html: proofOfDeliveryUrl ? `<p style="margin: 0 0 10px;"><a href="${proofOfDeliveryUrl}" style="color: #1d4ed8;">View proof of delivery</a></p>` : '',
      shelf_link_html: shelfPhotoUrl ? `<p style="margin: 0;"><a href="${shelfPhotoUrl}" style="color: #1d4ed8;">View shelf photo</a></p>` : '',
    },
  })
}

export async function sendDriverDeliveryAssignmentEmail({
  to,
  driverName,
  weekStartDate,
  stopCount,
}: {
  to: string
  driverName: string
  weekStartDate: string
  stopCount: number
}) {
  await sendAutomationEmail({
    key: 'driver_assignment',
    to,
    recipientName: driverName,
    variables: {
      driver_name: escapeHtml(driverName),
      week_start_date: escapeHtml(weekStartDate),
      stop_count: String(stopCount),
    },
  })
}

export async function sendTasterAssignmentEmail({
  to,
  tasterName,
  storeName,
  scheduledAt,
  endAt,
  notes,
}: {
  to: string
  tasterName: string
  storeName: string
  scheduledAt: Date
  endAt?: Date | null
  notes?: string | null
}) {
  const timeRange = formatEasternTimeRange(scheduledAt, endAt ?? null).replace(' ET', '')
  const scheduledLabel = formatEasternDateTime(scheduledAt).replace(' ET', '')

  await sendAutomationEmail({
    key: 'taster_assignment',
    to,
    recipientName: tasterName,
    variables: {
      taster_name: escapeHtml(tasterName),
      store_name: escapeHtml(storeName),
      scheduled_label: escapeHtml(`${scheduledLabel}${endAt ? ` - ${timeRange.split(' - ')[1]}` : ''} ET`),
      notes_html: notes ? `<p style="margin: 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : '',
    },
  })
}

export async function sendTastingStatusEmail({
  to,
  storeName,
  status,
  scheduledAt,
}: {
  to: string
  storeName: string
  status: 'confirmed' | 'cancelled' | 'declined'
  scheduledAt: Date
}) {
  const copy = {
    confirmed: {
      title: 'Tasting confirmed',
      intro: `Your tasting at ${storeName} has been confirmed.`,
    },
    cancelled: {
      title: 'Tasting cancelled',
      intro: `Your tasting at ${storeName} has been cancelled.`,
    },
    declined: {
      title: 'Tasting declined',
      intro: `The tasting at ${storeName} was declined and needs reassignment.`,
    },
  }[status]

  await sendAutomationEmail({
    key: 'tasting_status',
    to,
    recipientName: storeName,
    variables: {
      store_name: escapeHtml(storeName),
      scheduled_at: escapeHtml(formatEasternDateTime(scheduledAt)),
      status_title: escapeHtml(copy.title),
      status_intro: escapeHtml(copy.intro),
      status_cta_label: status === 'declined' ? 'Open tastings' : 'Open tasting portal',
      status_cta_path: status === 'declined' ? '/admin/tastings' : '/taster/tastings',
    },
  })
}

export async function sendTastingReportReceivedEmail({
  to,
  tasterName,
  storeName,
}: {
  to: string
  tasterName: string
  storeName: string
}) {
  await sendAutomationEmail({
    key: 'tasting_report_received',
    to,
    recipientName: tasterName,
    variables: {
      taster_name: escapeHtml(tasterName),
      store_name: escapeHtml(storeName),
    },
  })
}

export async function sendInternalAlertEmail({
  to,
  subject,
  title,
  body,
  href,
}: {
  to: string[]
  subject: string
  title: string
  body: string
  href?: string
}) {
  await sendAutomationEmail({
    key: 'internal_alert',
    to,
    variables: {
      subject,
      title: escapeHtml(title),
      body: escapeHtml(body),
      href: href ?? '',
    },
  })
}

export async function sendWholesalerInvitationEmail({
  to,
  senderName,
  personalMessage,
}: {
  to: string
  senderName: string
  personalMessage?: string | null
}): Promise<void> {
  const joinUrl = portalUrl('/join')
  await sendEmail({
    to,
    subject: `You've been invited to join the AHAWC Distribution Portal`,
    html: renderEmailCard({
      eyebrow: 'Invitation',
      title: "You're invited to join AHAWC",
      intro: `${escapeHtml(senderName)} has invited you to request a wholesale account on the AHAWC Distribution Portal.`,
      body: `
        ${personalMessage ? `<p style="margin: 0 0 14px;">${escapeHtml(personalMessage)}</p>` : ''}
        <p style="margin: 0 0 10px;">Click the button below to fill out our short access request form. Once submitted, our team will review your application and follow up shortly.</p>
        <p style="margin: 0; color: #64748b; font-size: 13px;">This invitation was sent by ${escapeHtml(senderName)} on behalf of AHAWC.</p>
      `,
      ctaLabel: 'Request Access',
      ctaHref: joinUrl,
    }),
  })
}

export async function sendTasterInvoiceNotification({
  payeeName,
  payeeEmail,
  payeePhone,
  tastingName,
  tastingDate,
  storeAddress,
  hourlyRate,
  hoursWorked,
  mileage,
  expenseAmount,
  totalAmount,
  notes,
}: {
  payeeName: string
  payeeEmail: string
  payeePhone: string | null
  tastingName: string
  tastingDate: string
  storeAddress: string
  hourlyRate: string
  hoursWorked: string
  mileage: string
  expenseAmount: string
  totalAmount: string
  notes: string | null
}): Promise<void> {
  await sendAutomationEmail({
    key: 'taster_invoice',
    to: process.env.TASTER_ACCOUNTING_EMAIL ?? 'kris@ahawc.com',
    recipientName: payeeName,
    variables: {
      payee_name: escapeHtml(payeeName),
      payee_email: escapeHtml(payeeEmail),
      payee_phone: escapeHtml(payeePhone ?? '-'),
      tasting_name: escapeHtml(tastingName),
      tasting_date: escapeHtml(tastingDate),
      store_address: escapeHtml(storeAddress || '-'),
      hourly_rate_currency: formatCurrencyValue(hourlyRate),
      hours_worked: Number(hoursWorked || 0).toFixed(2),
      mileage: Number(mileage || 0).toFixed(2),
      expense_amount_currency: formatCurrencyValue(expenseAmount),
      total_amount_currency: formatCurrencyValue(totalAmount),
      notes_html: notes ? `<p style="margin: 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : '',
    },
  })
}
