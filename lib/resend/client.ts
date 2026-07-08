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

if (!process.env.RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY')
const resend = new Resend(process.env.RESEND_API_KEY)

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

export async function sendInvoicePaymentReminderEmail({
  to,
  companyName,
  invoiceId,
  invoiceNumber,
  total,
  dueDate,
  stage,
}: {
  to: string | string[]
  companyName: string
  invoiceId: string
  invoiceNumber: string
  total: string
  dueDate: string
  stage: 'five_day' | 'due_today'
}) {
  const reminderTitle = stage === 'due_today' ? 'Invoice due today' : 'Invoice due soon'
  const reminderIntro = stage === 'due_today'
    ? `Payment is due today for ${companyName}.`
    : `This is a reminder that payment for ${companyName} is due in 5 days.`

  await sendAutomationEmail({
    key: 'invoice_payment_reminder',
    to,
    recipientName: companyName,
    variables: {
      invoice_id: invoiceId,
      invoice_number: escapeHtml(invoiceNumber),
      company_name: escapeHtml(companyName),
      total_currency: formatCurrencyValue(total),
      due_date: escapeHtml(dueDate),
      reminder_title: escapeHtml(reminderTitle),
      reminder_intro: escapeHtml(reminderIntro),
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
    to: process.env.SAMPLE_CASE_ALERT_EMAIL ?? '',
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
  to,
  businessName,
  businessEmail,
  businessType,
  phone,
  phoneNormalized,
  smsOptIn,
}: {
  to: string | string[]
  businessName: string
  businessEmail: string
  businessType?: string | null
  phone: string | null
  phoneNormalized: string | null
  smsOptIn: boolean
}): Promise<void> {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean)
  if (!recipients.length) return
  await sendAutomationEmail({
    key: 'wholesale_request',
    to: recipients,
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

export async function sendWholesalerApprovalEmail({
  to,
  businessName,
  senderName,
  personalMessage,
}: {
  to: string
  businessName: string
  senderName: string
  personalMessage?: string | null
}): Promise<void> {
  const loginUrl = portalUrl(`/login?email=${encodeURIComponent(to)}`)
  await sendEmail({
    to,
    subject: `${businessName} has been approved for the AHAWC Portal`,
    html: renderEmailCard({
      eyebrow: 'Approved',
      title: 'Your wholesale access has been approved',
      intro: `${escapeHtml(senderName)} approved ${escapeHtml(businessName)} for access to the AHAWC Distribution Portal.`,
      body: `
        ${personalMessage ? `<p style="margin: 0 0 14px;">${escapeHtml(personalMessage)}</p>` : ''}
        <p style="margin: 0 0 10px;">Use the button below to sign in.</p>
        <p style="margin: 0 0 10px;">If this is your first time accessing the portal, choose <strong>Continue with Google</strong> and use this approved email address: <strong>${escapeHtml(to)}</strong>.</p>
        <p style="margin: 0; color: #64748b; font-size: 13px;">If you already have a password-based account, you can sign in with your email and password instead.</p>
      `,
      ctaLabel: 'Open Sign In',
      ctaHref: loginUrl,
    }),
  })
}

export async function sendSalesRepInviteEmail({
  to,
  invitedName,
  senderName,
  inviteUrl,
  expiresAt,
}: {
  to: string
  invitedName?: string | null
  senderName: string
  inviteUrl: string
  expiresAt: Date
}): Promise<void> {
  const expiresLabel = expiresAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  await sendEmail({
    to,
    recipientName: invitedName ?? to,
    subject: 'Create your AHAWC sales rep account',
    html: renderEmailCard({
      eyebrow: 'Sales Invite',
      title: `You're invited to join AHAWC sales`,
      intro: `${escapeHtml(senderName)} invited you to create your AHAWC sales rep portal account.`,
      body: `
        <p style="margin: 0 0 14px;">Use the button below to set your password and finish creating your sales rep account.</p>
        <p style="margin: 0 0 10px;"><strong>Email:</strong> ${escapeHtml(to)}</p>
        <p style="margin: 0;"><strong>Invite expires:</strong> ${escapeHtml(expiresLabel)}</p>
      `,
      ctaLabel: 'Create Sales Rep Account',
      ctaHref: inviteUrl,
    }),
  })
}

export async function sendTasterInvoiceNotification({
  to,
  payeeName,
  payeeEmail,
  payeePhone,
  tastingName,
  tastingDate,
  storeAddress,
  hourlyRate,
  hoursWorked,
  expenseAmount,
  totalAmount,
  receiptUrls,
  notes,
}: {
  to: string[]
  payeeName: string
  payeeEmail: string
  payeePhone: string | null
  tastingName: string
  tastingDate: string
  storeAddress: string
  hourlyRate: string
  hoursWorked: string
  expenseAmount: string
  totalAmount: string
  receiptUrls: string[]
  notes: string | null
}): Promise<void> {
  await sendAutomationEmail({
    key: 'taster_invoice',
    to,
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
      expense_amount_currency: formatCurrencyValue(expenseAmount),
      total_amount_currency: formatCurrencyValue(totalAmount),
      receipts_html: receiptUrls.length
        ? `<p style="margin: 12px 0 0;"><strong>Receipts:</strong></p><ul style="margin: 8px 0 0; padding-left: 18px;">${receiptUrls.map((url) => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></li>`).join('')}</ul>`
        : '',
      notes_html: notes ? `<p style="margin: 0;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : '',
    },
  })
}

export async function sendTasterAddressChangeNotification({
  to,
  tasterName,
  tasterEmail,
  tasterPhone,
  previousAddress,
  newAddress,
  profilePath,
}: {
  to: string[]
  tasterName: string
  tasterEmail: string
  tasterPhone: string | null
  previousAddress: string
  newAddress: string
  profilePath?: string
}) {
  await sendEmail({
    to,
    recipientName: tasterName,
    subject: `Taster address updated - ${tasterName}`,
    html: renderEmailCard({
      eyebrow: 'Taster update',
      title: 'Taster address updated',
      intro: `${escapeHtml(tasterName)} updated their address in the tasting portal.`,
      body: `
        <p style="margin: 0 0 10px;"><strong>Taster:</strong> ${escapeHtml(tasterName)}</p>
        <p style="margin: 0 0 10px;"><strong>Email:</strong> ${escapeHtml(tasterEmail || '-')}</p>
        <p style="margin: 0 0 10px;"><strong>Phone:</strong> ${escapeHtml(tasterPhone ?? '-')}</p>
        <p style="margin: 0 0 10px;"><strong>Previous address:</strong> ${escapeHtml(previousAddress)}</p>
        <p style="margin: 0;"><strong>New address:</strong> ${escapeHtml(newAddress)}</p>
      `,
      ctaLabel: profilePath ? 'Open taster profile' : undefined,
      ctaHref: profilePath ? portalUrl(profilePath) : undefined,
    }),
  })
}

export async function sendSalesRepDigestEmail({
  to,
  repName,
  overdueAccounts,
  dueSoonAccounts,
  reorderFollowUps,
  pendingCommissions,
}: {
  to: string
  repName: string
  overdueAccounts: string[]
  dueSoonAccounts: string[]
  reorderFollowUps: string[]
  pendingCommissions: number
}) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
  const listHtml = (items: string[], emptyMsg: string) =>
    items.length > 0
      ? `<ul style="margin: 0; padding-left: 18px;">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
      : `<p style="margin: 0; color: #64748b;">${emptyMsg}</p>`

  const html = renderEmailCard({
    eyebrow: 'Daily Briefing',
    title: `Good morning, ${escapeHtml(repName)}`,
    intro: "Here's your sales recap for today.",
    body: `
      <p style="margin: 0 0 6px; font-weight: 600; color: #ef4444;">⚠ Overdue Visits (${overdueAccounts.length})</p>
      ${listHtml(overdueAccounts, 'No overdue visits — great work!')}

      <p style="margin: 14px 0 6px; font-weight: 600; color: #f59e0b;">📅 Due This Week (${dueSoonAccounts.length})</p>
      ${listHtml(dueSoonAccounts, 'No visits due this week.')}

      <p style="margin: 14px 0 6px; font-weight: 600; color: #3b82f6;">🔁 Reorder Follow-ups (${reorderFollowUps.length})</p>
      ${listHtml(reorderFollowUps, 'No reorder follow-ups right now.')}

      <p style="margin: 14px 0 6px; font-weight: 600; color: #10b981;">💰 Pending Commissions</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b;">${fmt(pendingCommissions)}</p>
    `,
    ctaLabel: 'Open Sales Portal',
    ctaHref: portalUrl('/sales/dashboard'),
  })

  await sendEmail({
    to,
    subject: `Your daily briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
    html,
  })
}

export async function sendIndustryNewsAlertEmail({
  to,
  recipientName,
  audienceLabel,
  title,
  summary,
  whyItMatters,
  articleUrl,
  imageUrl,
}: {
  to: string
  recipientName?: string | null
  audienceLabel: string
  title: string
  summary: string
  whyItMatters: string
  articleUrl: string
  imageUrl?: string | null
}) {
  const imageBlock = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:16px;" />`
    : ''

  const html = renderEmailCard({
    eyebrow: 'Industry News',
    title: escapeHtml(title),
    intro: `${escapeHtml(audienceLabel)} update from the portal news feed.`,
    body: `
      ${imageBlock}
      <p style="margin: 0 0 12px;">${escapeHtml(summary)}</p>
      <p style="margin: 0;"><strong>Why it matters:</strong> ${escapeHtml(whyItMatters)}</p>
    `,
    ctaLabel: 'Read story',
    ctaHref: articleUrl,
  })

  await sendEmail({
    to,
    recipientName,
    subject: `Industry News: ${title}`,
    html,
  })
}

export async function sendIndustryNewsDigestEmail({
  to,
  recipientName,
  audienceLabel,
  frequencyLabel,
  stories,
  portalPath,
}: {
  to: string
  recipientName?: string | null
  audienceLabel: string
  frequencyLabel: 'Daily' | 'Weekly'
  stories: Array<{
    title: string
    summary: string
    whyItMatters: string
    articleUrl: string
    publishedAt: string
    sourceName: string
  }>
  portalPath: string
}) {
  const body = stories.length
    ? stories.map((story) => `
        <div style="padding: 0 0 16px; margin: 0 0 16px; border-bottom: 1px solid #e2e8f0;">
          <p style="margin: 0 0 6px; font-size: 12px; color: #64748b;">${escapeHtml(story.sourceName)} · ${escapeHtml(story.publishedAt)}</p>
          <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700;">${escapeHtml(story.title)}</p>
          <p style="margin: 0 0 10px;">${escapeHtml(story.summary)}</p>
          <p style="margin: 0 0 10px;"><strong>Why it matters:</strong> ${escapeHtml(story.whyItMatters)}</p>
          <p style="margin: 0;"><a href="${escapeHtml(story.articleUrl)}">Open article</a></p>
        </div>
      `).join('')
    : '<p style="margin: 0;">No new industry stories matched your role during this window.</p>'

  const html = renderEmailCard({
    eyebrow: 'Industry News Digest',
    title: `${frequencyLabel} ${escapeHtml(audienceLabel)} briefing`,
    intro: `Your ${frequencyLabel.toLowerCase()} industry news digest from the AHAWC portal.`,
    body,
    ctaLabel: 'Open news feed',
    ctaHref: portalUrl(portalPath),
  })

  await sendEmail({
    to,
    recipientName,
    subject: `${frequencyLabel} Industry News Digest`,
    html,
  })
}

export async function sendNewOrderStaffNotification({
  to,
  companyName,
  orderId,
  total,
  purchaseUnit,
  placedBy,
}: {
  to: string[]
  companyName: string
  orderId: string
  total: string
  purchaseUnit: string
  placedBy: string
}): Promise<void> {
  const recipients = to.filter(Boolean)
  if (!recipients.length) return
  const orderShortId = orderId.slice(-8).toUpperCase()
  const orderUrl = portalUrl(`/admin/orders/${orderId}`)
  const subject = `New order from ${companyName} — $${total}`
  const html = renderEmailCard({
    eyebrow: 'New Order',
    title: `Order from ${escapeHtml(companyName)}`,
    intro: `${escapeHtml(placedBy)} placed a ${purchaseUnit} order totaling $${escapeHtml(total)}.`,
    body: `<p style="margin: 0 0 10px;"><strong>Order ID:</strong> ${escapeHtml(orderShortId)}</p><p style="margin: 0;"><strong>Total:</strong> $${escapeHtml(total)}</p>`,
    ctaLabel: 'View Order',
    ctaHref: orderUrl,
  })
  await sendEmail({ to: recipients, subject, html })
}
