import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { activityEvents, customerAccounts, invoices } from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'
import { sendInvoicePaymentReminderEmail } from '@/lib/resend/client'
import { sendSms } from '@/lib/telnyx/client'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function toDateKey(date: Date, timeZone = 'America/New_York') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function diffDays(fromDateKey: string, toDateKeyValue: string) {
  const from = Date.parse(`${fromDateKey}T00:00:00Z`)
  const to = Date.parse(`${toDateKeyValue}T00:00:00Z`)
  return Math.round((to - from) / 86400000)
}

function formatDueDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T12:00:00Z`))
}

function getReminderStage(daysUntilDue: number) {
  if (daysUntilDue === 5) return 'five_day'
  if (daysUntilDue === 0) return 'due_today'
  return null
}

function getReminderKind(stage: 'five_day' | 'due_today') {
  return stage === 'due_today' ? 'invoice_payment_reminder_due_date' : 'invoice_payment_reminder_5_day'
}

function getPreferredEmail(account: {
  email: string | null
  businessEmail: string | null
  pocEmail: string | null
}) {
  return account.pocEmail || account.businessEmail || account.email || null
}

function getPreferredPhone(account: {
  notificationPhone: string | null
  pocPhone: string | null
  businessPhone: string | null
  phone: string | null
}) {
  return account.notificationPhone || account.pocPhone || account.businessPhone || account.phone || null
}

function allowsEmail(notificationPreference: string | null) {
  return !notificationPreference || notificationPreference === 'email' || notificationPreference === 'both'
}

function allowsSms(notificationPreference: string | null) {
  return notificationPreference === 'sms' || notificationPreference === 'both'
}

function buildSmsBody({
  companyName,
  invoiceNumber,
  total,
  dueDateLabel,
  stage,
}: {
  companyName: string
  invoiceNumber: string
  total: string
  dueDateLabel: string
  stage: 'five_day' | 'due_today'
}) {
  const lead = stage === 'due_today'
    ? `AHAWC reminder: Invoice ${invoiceNumber} for ${companyName} is due today.`
    : `AHAWC reminder: Invoice ${invoiceNumber} for ${companyName} is due in 5 days.`
  return `${lead} Amount due: $${Number(total).toFixed(2)}. Due date: ${dueDateLabel}.`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayKey = toDateKey(now)
  const dayStart = new Date(`${todayKey}T00:00:00Z`)

  const openInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      total: invoices.total,
      dueDate: invoices.dueDate,
      status: invoices.status,
      customerId: customerAccounts.id,
      companyName: customerAccounts.companyName,
      paymentTerms: customerAccounts.paymentTerms,
      notificationPreference: customerAccounts.notificationPreference,
      email: customerAccounts.email,
      businessEmail: customerAccounts.businessEmail,
      pocEmail: customerAccounts.pocEmail,
      phone: customerAccounts.phone,
      businessPhone: customerAccounts.businessPhone,
      pocPhone: customerAccounts.pocPhone,
      notificationPhone: customerAccounts.notificationPhone,
    })
    .from(invoices)
    .innerJoin(customerAccounts, eq(invoices.customerId, customerAccounts.id))
    .where(inArray(invoices.status, ['sent', 'overdue']))

  const candidates = openInvoices
    .filter(invoice => invoice.dueDate && invoice.paymentTerms !== 'PREPAID' && invoice.status !== 'paid')
    .map(invoice => {
      const dueDateKey = typeof invoice.dueDate === 'string'
        ? invoice.dueDate
        : toDateKey(new Date(invoice.dueDate), 'UTC')
      const daysUntilDue = diffDays(todayKey, dueDateKey)
      const stage = getReminderStage(daysUntilDue)
      return { invoice, dueDateKey, daysUntilDue, stage }
    })
    .filter((entry): entry is typeof entry & { stage: 'five_day' | 'due_today' } => entry.stage !== null)

  const candidateIds = candidates.map(entry => entry.invoice.id)
  const kinds = ['invoice_payment_reminder_5_day', 'invoice_payment_reminder_due_date']

  const sentToday = candidateIds.length > 0
    ? await db
        .select({
          entityId: activityEvents.entityId,
          kind: activityEvents.kind,
        })
        .from(activityEvents)
        .where(and(
          eq(activityEvents.entityType, 'invoice'),
          inArray(activityEvents.entityId, candidateIds),
          inArray(activityEvents.kind, kinds),
          gte(activityEvents.createdAt, dayStart),
        ))
    : []

  const sentTodaySet = new Set(sentToday.map(row => `${row.entityId}:${row.kind}`))

  let emailSent = 0
  let smsSent = 0
  let skipped = 0
  let failed = 0

  for (const entry of candidates) {
    try {
      const { invoice, dueDateKey, stage } = entry
      const reminderKind = getReminderKind(stage)

      if (sentTodaySet.has(`${invoice.id}:${reminderKind}`)) {
        skipped++
        continue
      }

      const notificationPreference = invoice.notificationPreference ?? 'email'
      const email = getPreferredEmail(invoice)
      const phone = getPreferredPhone(invoice)
      const dueDateLabel = formatDueDate(dueDateKey)

      let delivered = false

      if (allowsEmail(notificationPreference) && email) {
        await sendInvoicePaymentReminderEmail({
          to: email,
          companyName: invoice.companyName,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: String(invoice.total),
          dueDate: dueDateLabel,
          stage,
        })
        emailSent++
        delivered = true
      }

      if (allowsSms(notificationPreference) && phone) {
        await sendSms({
          to: phone,
          body: buildSmsBody({
            companyName: invoice.companyName,
            invoiceNumber: invoice.invoiceNumber,
            total: String(invoice.total),
            dueDateLabel,
            stage,
          }),
          contactName: invoice.companyName,
        })
        smsSent++
        delivered = true
      }

      if (!delivered) {
        skipped++
        continue
      }

      await logActivityEvent({
        entityType: 'invoice',
        entityId: invoice.id,
        kind: reminderKind,
        title: stage === 'due_today' ? 'Payment reminder sent on due date' : 'Payment reminder sent 5 days before due date',
        body: `${invoice.invoiceNumber} reminder sent via ${notificationPreference}.`,
        metadata: {
          stage,
          dueDate: dueDateKey,
          notificationPreference,
          emailed: allowsEmail(notificationPreference) && Boolean(email),
          texted: allowsSms(notificationPreference) && Boolean(phone),
        },
      })
    } catch (error) {
      failed++
      console.error('Invoice reminder failed:', error)
    }
  }

  return NextResponse.json({
    totalCandidates: candidates.length,
    emailSent,
    smsSent,
    skipped,
    failed,
  })
}
