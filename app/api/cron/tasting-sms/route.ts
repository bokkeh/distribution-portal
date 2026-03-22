import { and, eq, lte } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { scheduledSmsJobs } from '@/db/schema'
import { sendTastingSmsFromTemplate } from '@/lib/tastings/sms-series'

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
    .limit(50)

  let processed = 0

  for (const job of jobs) {
    try {
      await sendTastingSmsFromTemplate({
        templateKey: job.templateKey as any,
        payload: job.payload as any,
      })
      await db.update(scheduledSmsJobs).set({
        status: 'sent',
        sentAt: new Date(),
        lastError: null,
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
