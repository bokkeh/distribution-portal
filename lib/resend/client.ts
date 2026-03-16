import { db } from '@/db'
import { notificationsLog } from '@/db/schema'
import { formatEasternDateTime, formatEasternTimeRange } from '@/lib/tastings/time'
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
      })
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
      })
    ))
  }
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
  await sendEmail({
    to,
    subject: `Invoice ${invoiceNumber} from AHAWC`,
    recipientName: companyName,
    html: renderEmailCard({
      eyebrow: 'Invoice',
      title: `Invoice ${invoiceNumber}`,
      intro: `A new invoice is ready for ${escapeHtml(companyName)}.`,
      body: `
        <p style="margin: 0 0 12px;">Please review and pay the invoice below.</p>
        <p style="margin: 0; font-size: 28px; font-weight: 700;">$${parseFloat(total).toFixed(2)}</p>
      `,
      ctaLabel: 'View invoice',
      ctaHref: invoiceUrl,
    }),
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
  await sendEmail({
    to,
    subject: `Payment received for ${invoiceNumber}`,
    recipientName: companyName,
    html: renderEmailCard({
      eyebrow: 'Payment received',
      title: 'Invoice paid',
      intro: `We received payment for ${escapeHtml(companyName)}.`,
      body: `
        <p style="margin: 0 0 12px;"><strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}</p>
        <p style="margin: 0; font-size: 24px; font-weight: 700;">$${parseFloat(total).toFixed(2)}</p>
      `,
      ctaLabel: 'View invoices',
      ctaHref: portalUrl('/customer/invoices'),
    }),
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
  await sendEmail({
    to,
    recipientName: companyName,
    subject: `Order received for ${companyName}`,
    html: renderEmailCard({
      eyebrow: 'Order update',
      title: 'Order received',
      intro: `Your order for ${escapeHtml(companyName)} has been received and is now being reviewed.`,
      body: `
        <p style="margin: 0 0 12px;"><strong>Order:</strong> ${escapeHtml(orderId.slice(-8).toUpperCase())}</p>
        <p style="margin: 0;"><strong>Total:</strong> $${parseFloat(total).toFixed(2)}</p>
      `,
      ctaLabel: 'View order',
      ctaHref: portalUrl(`/customer/orders/${orderId}`),
    }),
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
      intro: `Your order for ${escapeHtml(companyName)} is pending review.`,
    },
    confirmed: {
      title: 'Order confirmed',
      intro: `Your order for ${escapeHtml(companyName)} has been confirmed.`,
    },
    fulfilled: {
      title: 'Order complete',
      intro: `Your order for ${escapeHtml(companyName)} has been completed.`,
    },
    cancelled: {
      title: 'Order cancelled',
      intro: `Your order for ${escapeHtml(companyName)} has been cancelled.`,
    },
  }[status]

  await sendEmail({
    to,
    recipientName: companyName,
    subject: `${copy.title} - ${companyName}`,
    html: renderEmailCard({
      eyebrow: 'Order status',
      title: copy.title,
      intro: copy.intro,
      body: `<p style="margin: 0;"><strong>Order:</strong> ${escapeHtml(orderId.slice(-8).toUpperCase())}</p>`,
      ctaLabel: 'Open order',
      ctaHref: portalUrl(`/customer/orders/${orderId}`),
    }),
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
      intro: `Your order for ${escapeHtml(companyName)} is awaiting delivery scheduling.`,
    },
    scheduled: {
      title: 'Delivery scheduled',
      intro: `Your order for ${escapeHtml(companyName)} has been scheduled for delivery.`,
    },
    out_for_delivery: {
      title: 'Order out for delivery',
      intro: `Your order for ${escapeHtml(companyName)} is currently out for delivery.`,
    },
    delivered: {
      title: 'Order delivered',
      intro: `Your order for ${escapeHtml(companyName)} has been delivered.`,
    },
    issue: {
      title: 'Delivery issue',
      intro: `There is an issue affecting delivery for ${escapeHtml(companyName)}.`,
    },
  }[status]

  await sendEmail({
    to,
    recipientName: companyName,
    subject: `${copy.title} - ${companyName}`,
    html: renderEmailCard({
      eyebrow: 'Delivery update',
      title: copy.title,
      intro: copy.intro,
      body: `<p style="margin: 0;"><strong>Order:</strong> ${escapeHtml(orderId.slice(-8).toUpperCase())}</p>`,
      ctaLabel: 'Track order',
      ctaHref: portalUrl(`/customer/orders/${orderId}`),
    }),
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
  phone,
  phoneNormalized,
  smsOptIn,
}: {
  businessName: string
  businessEmail: string
  phone: string | null
  phoneNormalized: string | null
  smsOptIn: boolean
}): Promise<void> {
  const to = process.env.WHOLESALE_REQUEST_NOTIFICATION_EMAIL ?? 'admin@ahawc.com'

  await sendEmail({
    to,
    recipientName: businessName,
    subject: `Wholesale account request - ${businessName}`,
    html: renderEmailCard({
      eyebrow: 'Wholesale request',
      title: 'New wholesale account request',
      intro: 'A new request was submitted from the public marketing form.',
      body: `
        <p style="margin: 0 0 10px;"><strong>Business:</strong> ${escapeHtml(businessName)}</p>
        <p style="margin: 0 0 10px;"><strong>Email:</strong> ${escapeHtml(businessEmail)}</p>
        <p style="margin: 0 0 10px;"><strong>Phone:</strong> ${escapeHtml(phone ?? '-')}</p>
        <p style="margin: 0 0 10px;"><strong>Normalized:</strong> ${escapeHtml(phoneNormalized ?? '-')}</p>
        <p style="margin: 0;"><strong>SMS opt-in:</strong> ${smsOptIn ? 'Yes' : 'No'}</p>
      `,
      ctaLabel: 'Open requests',
      ctaHref: portalUrl('/admin/wholesale-requests'),
    }),
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
  await sendEmail({
    to,
    recipientName: companyName,
    subject: `Delivery completed for ${companyName}`,
    html: renderEmailCard({
      eyebrow: 'Delivery completed',
      title: 'Your delivery has been completed',
      intro: `Your delivery for ${escapeHtml(companyName)} scheduled on ${escapeHtml(deliveryDate)} has been marked delivered.`,
      body: `
        <p style="margin: 0 0 10px;"><strong>Account:</strong> ${escapeHtml(companyName)}</p>
        ${proofOfDeliveryUrl ? `<p style="margin: 0 0 10px;"><a href="${proofOfDeliveryUrl}" style="color: #1d4ed8;">View proof of delivery</a></p>` : ''}
        ${shelfPhotoUrl ? `<p style="margin: 0;"><a href="${shelfPhotoUrl}" style="color: #1d4ed8;">View shelf photo</a></p>` : ''}
      `,
    }),
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
  await sendEmail({
    to,
    recipientName: driverName,
    subject: `Delivery route assigned - ${weekStartDate}`,
    html: renderEmailCard({
      eyebrow: 'Driver assignment',
      title: 'New delivery route assigned',
      intro: `${escapeHtml(driverName)}, you have a delivery route scheduled for ${escapeHtml(weekStartDate)}.`,
      body: `<p style="margin: 0;"><strong>Stops assigned:</strong> ${stopCount}</p>`,
      ctaLabel: 'Open driver portal',
      ctaHref: portalUrl('/driver/deliveries'),
    }),
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

  await sendEmail({
    to,
    recipientName: tasterName,
    subject: `Tasting assigned - ${storeName}`,
    html: renderEmailCard({
      eyebrow: 'Tasting assignment',
      title: 'New tasting assigned',
      intro: `${escapeHtml(tasterName)}, you have been assigned to ${escapeHtml(storeName)}.`,
      body: `
        <p style="margin: 0 0 10px;"><strong>When:</strong> ${escapeHtml(`${scheduledLabel}${endAt ? ` - ${timeRange.split(' - ')[1]}` : ''} ET`)}</p>
        <p style="margin: 0 0 10px;"><strong>Store:</strong> ${escapeHtml(storeName)}</p>
        ${notes ? `<p style="margin: 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
      `,
      ctaLabel: 'Review tasting',
      ctaHref: portalUrl('/taster/tastings'),
    }),
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
      intro: `Your tasting at ${escapeHtml(storeName)} has been confirmed.`,
    },
    cancelled: {
      title: 'Tasting cancelled',
      intro: `Your tasting at ${escapeHtml(storeName)} has been cancelled.`,
    },
    declined: {
      title: 'Tasting declined',
      intro: `The tasting at ${escapeHtml(storeName)} was declined and needs reassignment.`,
    },
  }[status]

  await sendEmail({
    to,
    recipientName: storeName,
    subject: `${copy.title} - ${storeName}`,
    html: renderEmailCard({
      eyebrow: 'Tasting update',
      title: copy.title,
      intro: copy.intro,
      body: `<p style="margin: 0;"><strong>Scheduled for:</strong> ${escapeHtml(formatEasternDateTime(scheduledAt))}</p>`,
      ctaLabel: status === 'declined' ? 'Open tastings' : 'Open tasting portal',
      ctaHref: portalUrl(status === 'declined' ? '/admin/tastings' : '/taster/tastings'),
    }),
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
  await sendEmail({
    to,
    recipientName: tasterName,
    subject: `Tasting report received - ${storeName}`,
    html: renderEmailCard({
      eyebrow: 'Report received',
      title: 'Tasting report submitted',
      intro: `Thanks, ${escapeHtml(tasterName)}. Your tasting report for ${escapeHtml(storeName)} has been received.`,
      body: '<p style="margin: 0;">You can return to the portal anytime to review your submitted activity and invoice status.</p>',
      ctaLabel: 'Open my tastings',
      ctaHref: portalUrl('/taster/tastings'),
    }),
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
  await sendEmail({
    to,
    subject,
    html: renderEmailCard({
      eyebrow: 'Internal alert',
      title,
      intro: body,
      body: '<p style="margin: 0;">Review the update in the portal.</p>',
      ctaLabel: href ? 'Open portal' : undefined,
      ctaHref: href ? portalUrl(href) : undefined,
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
  const to = process.env.TASTER_ACCOUNTING_EMAIL ?? 'kris@ahawc.com'

  await sendEmail({
    to,
    recipientName: payeeName,
    subject: `Taster invoice submitted - ${payeeName} - ${tastingName}`,
    html: renderEmailCard({
      eyebrow: 'Taster invoice',
      title: 'A taster invoice was submitted',
      intro: `${escapeHtml(payeeName)} submitted an invoice for ${escapeHtml(tastingName)}.`,
      body: `
        <p style="margin: 0 0 10px;"><strong>Email:</strong> ${escapeHtml(payeeEmail)}</p>
        <p style="margin: 0 0 10px;"><strong>Phone:</strong> ${escapeHtml(payeePhone ?? '-')}</p>
        <p style="margin: 0 0 10px;"><strong>Date:</strong> ${escapeHtml(tastingDate)}</p>
        <p style="margin: 0 0 10px;"><strong>Location:</strong> ${escapeHtml(storeAddress || '-')}</p>
        <p style="margin: 0 0 10px;"><strong>Hourly rate:</strong> $${Number(hourlyRate || 0).toFixed(2)}</p>
        <p style="margin: 0 0 10px;"><strong>Hours worked:</strong> ${Number(hoursWorked || 0).toFixed(2)}</p>
        <p style="margin: 0 0 10px;"><strong>Mileage:</strong> ${Number(mileage || 0).toFixed(2)}</p>
        <p style="margin: 0 0 10px;"><strong>Expenses:</strong> $${Number(expenseAmount || 0).toFixed(2)}</p>
        <p style="margin: 0 0 10px;"><strong>Total due:</strong> $${Number(totalAmount || 0).toFixed(2)}</p>
        ${notes ? `<p style="margin: 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
      `,
      ctaLabel: 'Open invoicing',
      ctaHref: portalUrl('/admin/invoicing'),
    }),
  })
}
