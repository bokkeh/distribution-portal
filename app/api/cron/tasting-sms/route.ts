import { and, asc, eq, lte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { scheduledSmsJobs, tastings, users, userPreferences } from '@/db/schema'
import { formatTastingSmsPayload, sendTastingSmsFromTemplate } from '@/lib/tastings/sms-series'
import { getTastingSmsDisposition, getTastingSmsSchedule, SCHEDULED_TASTING_SMS_KEYS, type ScheduledTastingSmsKey } from '@/lib/tastings/sms-schedule'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = await db.select().from(scheduledSmsJobs)
    .where(and(eq(scheduledSmsJobs.status, 'pending'), lte(scheduledSmsJobs.sendAt, new Date())))
    .orderBy(asc(scheduledSmsJobs.sendAt))
    .limit(50)

  let processed = 0

  for (const job of jobs) {
    // Claim before sending: overlapping cron runs must not both deliver this job.
    const [claimed] = await db.update(scheduledSmsJobs).set({ status: 'sending' })
      .where(and(eq(scheduledSmsJobs.id, job.id), eq(scheduledSmsJobs.status, 'pending'))).returning({ id: scheduledSmsJobs.id })
    if (!claimed) continue
    try {
      const [current] = job.tastingId ? await db.select({ tasting: tastings, user: users, smsEnabled: userPreferences.smsNotificationsEnabled })
        .from(tastings).innerJoin(users, eq(users.id, tastings.assignedUserId))
        .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
        .where(eq(tastings.id, job.tastingId)).limit(1) : []
      if (!current || !['scheduled', 'confirmed'].includes(current.tasting.status)
        || current.user.id !== job.userId || !current.user.active || !current.user.phone
        || current.smsEnabled === false || !SCHEDULED_TASTING_SMS_KEYS.some(key => key === job.templateKey)) {
        await db.update(scheduledSmsJobs).set({ status: 'cancelled', lastError: 'Tasting or recipient is no longer eligible.' }).where(eq(scheduledSmsJobs.id, job.id))
        continue
      }
      const { tasting, user } = current
      const key = job.templateKey as ScheduledTastingSmsKey
      const now = new Date()
      const disposition = getTastingSmsDisposition(key, tasting.scheduledAt, tasting.endAt, now)
      const payload = formatTastingSmsPayload({
        tastingId: tasting.id, userId: user.id, phoneNumber: user.phone!,
        storeName: tasting.eventName,
        storeAddress: [tasting.storeAddress, tasting.storeCity, tasting.storeState, tasting.storeZip].filter(Boolean).join(', ') || 'Store address not provided',
        scheduledAt: tasting.scheduledAt, endAt: tasting.endAt,
      })
      if (disposition !== 'send') {
        await db.update(scheduledSmsJobs).set({
          status: disposition === 'reschedule' ? 'pending' : 'cancelled',
          sendAt: getTastingSmsSchedule(tasting.scheduledAt, tasting.endAt)[key],
          payload, phoneNumber: user.phone!,
          lastError: disposition === 'cancel' ? 'Reminder window expired; suppressed outdated message.' : null,
        }).where(eq(scheduledSmsJobs.id, job.id))
        continue
      }
      await sendTastingSmsFromTemplate({
        templateKey: key,
        payload,
      })
      await db.update(scheduledSmsJobs).set({
        status: 'sent',
        sentAt: new Date(),
        lastError: null,
        payload, phoneNumber: user.phone!,
      }).where(eq(scheduledSmsJobs.id, job.id))
      processed += 1
    } catch (error) {
      await db.update(scheduledSmsJobs).set({
        status: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
      }).where(eq(scheduledSmsJobs.id, job.id))
    }
  }

  return NextResponse.json({ processed, total: jobs.length })
}
