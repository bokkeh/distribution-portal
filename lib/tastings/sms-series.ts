import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { notificationsLog, scheduledSmsJobs, tastingSmsTemplates } from '@/db/schema'
import { sendSms } from '@/lib/telnyx/client'
import {
  formatEasternDate,
  formatEasternTime,
  formatEasternTimeRange,
  getEasternDateKey,
  parseDateTimeInTimeZone,
} from '@/lib/tastings/time'

export const TASTING_SMS_SEQUENCE = [
  {
    key: 'assignment',
    label: 'Tasting Assignment',
    description: 'Sent immediately when a tasting is assigned.',
    linkPath: '/tasting/confirm',
    bodyTemplate: `AHAWC Distribution: A tasting has been assigned to you.

Store: {{store_name}}
Date: {{date}}
Time: {{time_range}}

Review details and confirm here:
{{portal_link}}

Reply HELP for help. Reply STOP to opt out.`,
  },
  {
    key: 'confirmation_received',
    label: 'Confirmation Received',
    description: 'Sent after the taster confirms the assignment.',
    linkPath: '/taster/tastings',
    bodyTemplate: `AHAWC Distribution: Your tasting has been confirmed.

Store: {{store_name}}
Date: {{date}}
Time: {{time_range}}

View event details in the portal:
{{portal_link}}

Please arrive 15 minutes early for setup.`,
  },
  {
    key: 'day_before_reminder',
    label: 'Day Before Reminder',
    description: 'Sent 24 hours before the tasting start.',
    linkPath: '/taster/tastings',
    bodyTemplate: `AHAWC Distribution reminder: You have a tasting tomorrow.

Store: {{store_name}}
Address: {{store_address}}
Time: {{time_range}}

Review instructions and materials:
{{portal_link}}`,
  },
  {
    key: 'day_of_reminder',
    label: 'Day Of Reminder',
    description: 'Sent the day of the tasting before start time.',
    linkPath: '/tasting/checkin',
    bodyTemplate: `AHAWC Distribution reminder: Your tasting today starts at {{start_time}}.

Store: {{store_name}}

Check in when you arrive:
{{portal_link}}

Please arrive 15 minutes early to set up.`,
  },
  {
    key: 'checkin_prompt',
    label: 'Check-In Prompt',
    description: 'Sent when the tasting window begins.',
    linkPath: '/tasting/checkin',
    bodyTemplate: `AHAWC Distribution: Your tasting window has started.

Please check in and confirm your setup here:
{{portal_link}}`,
  },
  {
    key: 'mid_event_check',
    label: 'Mid-Event Check',
    description: 'Sent during the middle of the tasting window.',
    linkPath: '/tasting/report',
    bodyTemplate: `AHAWC Distribution: Quick check in from the team.

If possible, update bottle counts and notes in the portal:
{{portal_link}}`,
  },
  {
    key: 'end_of_tasting',
    label: 'End Of Tasting',
    description: 'Sent when the tasting window ends.',
    linkPath: '/tasting/report',
    bodyTemplate: `AHAWC Distribution: Your tasting window has ended.

Please submit your tasting report here:
{{portal_link}}

Include bottles sold and any store feedback.`,
  },
  {
    key: 'report_received',
    label: 'Report Received',
    description: 'Sent immediately after a tasting report is submitted.',
    linkPath: '/taster/tastings',
    bodyTemplate: `AHAWC Distribution: Your tasting report has been received.

Thank you for representing Wisher Vodka today.
You can view your activity in the portal:
{{portal_link}}`,
  },
] as const

type TemplateKey = typeof TASTING_SMS_SEQUENCE[number]['key']

type SmsPayload = {
  tastingId: string
  userId: string
  phoneNumber: string
  store_name: string
  store_address: string
  date: string
  start_time: string
  time_range: string
}

function getBaseUrl() {
  return process.env.NEXTAUTH_URL ?? 'https://ahawc.com'
}

function renderTemplate(template: string, replacements: Record<string, string>) {
  return Object.entries(replacements).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
    template,
  )
}

export function formatTastingSmsPayload(input: {
  tastingId: string
  userId: string
  phoneNumber: string
  storeName: string
  storeAddress: string
  scheduledAt: Date
  endAt: Date | null
}): SmsPayload {
  const scheduledAt = new Date(input.scheduledAt)
  const endAt = input.endAt ? new Date(input.endAt) : null
  return {
    tastingId: input.tastingId,
    userId: input.userId,
    phoneNumber: input.phoneNumber,
    store_name: input.storeName,
    store_address: input.storeAddress,
    date: formatEasternDate(scheduledAt),
    start_time: formatEasternTime(scheduledAt),
    time_range: formatEasternTimeRange(scheduledAt, endAt),
  }
}

export function getTastingActionLink(templateKey: TemplateKey, tastingId: string) {
  const definition = TASTING_SMS_SEQUENCE.find(item => item.key === templateKey)
  const linkPath = definition?.linkPath ?? '/taster/tastings'
  const url = new URL(linkPath, getBaseUrl())
  if (linkPath.startsWith('/tasting/')) {
    url.searchParams.set('tastingId', tastingId)
  }
  return url.toString()
}

export async function getTastingSmsTemplates() {
  const rows = await db.select().from(tastingSmsTemplates).orderBy(tastingSmsTemplates.sortOrder)
  if (rows.length) return rows
  return TASTING_SMS_SEQUENCE.map((template, index) => ({
    id: `default-${template.key}`,
    key: template.key,
    label: template.label,
    description: template.description,
    bodyTemplate: template.bodyTemplate,
    linkPath: template.linkPath,
    sortOrder: index,
    updatedAt: new Date(),
  }))
}

export async function getTastingSmsTemplateMap() {
  const templates = await getTastingSmsTemplates()
  return new Map(templates.map(template => [template.key, template]))
}

export async function sendTastingSmsFromTemplate({
  templateKey,
  payload,
}: {
  templateKey: TemplateKey
  payload: SmsPayload
}) {
  const templateMap = await getTastingSmsTemplateMap()
  const template = templateMap.get(templateKey)
  if (!template) throw new Error(`Missing tasting SMS template: ${templateKey}`)

  const portalLink = getTastingActionLink(templateKey, payload.tastingId)
  const body = renderTemplate(template.bodyTemplate, {
    ...payload,
    portal_link: portalLink,
  })

  await sendSms({ to: payload.phoneNumber, body })
  await db.insert(notificationsLog).values({
    userId: payload.userId,
    recipientPhone: payload.phoneNumber,
    recipientName: payload.store_name,
    type: 'sms',
    message: body,
    status: 'sent',
  })
}

export async function upsertDefaultTastingSmsTemplates() {
  const existing = await db.select().from(tastingSmsTemplates).orderBy(tastingSmsTemplates.sortOrder)
  if (existing.length) return

  for (let index = 0; index < TASTING_SMS_SEQUENCE.length; index++) {
    const template = TASTING_SMS_SEQUENCE[index]
    await db.insert(tastingSmsTemplates).values({
      key: template.key,
      label: template.label,
      description: template.description,
      bodyTemplate: template.bodyTemplate,
      linkPath: template.linkPath,
      sortOrder: index,
    })
  }
}

export async function clearScheduledTastingSmsJobs(tastingId: string) {
  await db.update(scheduledSmsJobs)
    .set({ status: 'cancelled' })
    .where(and(eq(scheduledSmsJobs.tastingId, tastingId), eq(scheduledSmsJobs.status, 'pending')))
}

export async function queueScheduledTastingSmsJobs(payload: SmsPayload & { scheduledAt: Date; endAt: Date | null }) {
  const startAt = new Date(payload.scheduledAt)
  const endAt = payload.endAt ? new Date(payload.endAt) : new Date(startAt.getTime() + 2 * 60 * 60 * 1000)
  const midpoint = new Date(startAt.getTime() + Math.max(30, Math.round((endAt.getTime() - startAt.getTime()) / 2 / 60000)) * 60000)
  const dayBefore = new Date(startAt.getTime() - 24 * 60 * 60 * 1000)
  const easternReminderStart = parseDateTimeInTimeZone(getEasternDateKey(startAt), '09:00')
  const dayOfReminder = new Date(Math.max(easternReminderStart.getTime(), startAt.getTime() - 2 * 60 * 60 * 1000))

  const jobs: Array<{ templateKey: TemplateKey; sendAt: Date }> = [
    { templateKey: 'day_before_reminder', sendAt: dayBefore },
    { templateKey: 'day_of_reminder', sendAt: dayOfReminder },
    { templateKey: 'checkin_prompt', sendAt: startAt },
    { templateKey: 'mid_event_check', sendAt: midpoint },
    { templateKey: 'end_of_tasting', sendAt: endAt },
  ]

  const now = Date.now()
  for (const job of jobs) {
    if (job.sendAt.getTime() <= now) continue
    await db.insert(scheduledSmsJobs).values({
      tastingId: payload.tastingId,
      userId: payload.userId,
      templateKey: job.templateKey,
      phoneNumber: payload.phoneNumber,
      payload: payload as unknown as Record<string, unknown>,
      sendAt: job.sendAt,
    })
  }
}

export async function getPendingScheduledSmsJobs(limit = 50) {
  return db.select().from(scheduledSmsJobs)
    .where(and(eq(scheduledSmsJobs.status, 'pending')))
    .orderBy(desc(scheduledSmsJobs.sendAt))
    .limit(limit)
}
