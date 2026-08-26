import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { notificationsLog, users } from '@/db/schema'
import { sendTasterAvailabilityReminderEmail } from '@/lib/resend/client'
import {
  getAvailabilityReminderSchedule,
  getAvailabilityReminderSms,
  getAvailabilityReminderSubject,
  getTasterAvailabilityUrl,
} from '@/lib/tastings/availability-reminder'
import { sendSms } from '@/lib/telnyx/client'

export const maxDuration = 60

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

async function wasAlreadySent(userId: string, type: 'email' | 'sms', message: string) {
  const [existing] = await db
    .select({ id: notificationsLog.id })
    .from(notificationsLog)
    .where(and(
      eq(notificationsLog.userId, userId),
      eq(notificationsLog.type, type),
      eq(notificationsLog.message, message),
      eq(notificationsLog.status, 'sent'),
    ))
    .limit(1)

  return Boolean(existing)
}

async function logSmsReminder({
  userId,
  phone,
  name,
  message,
  status,
}: {
  userId: string
  phone: string
  name: string
  message: string
  status: 'sent' | 'failed'
}) {
  await db.insert(notificationsLog).values({
    userId,
    recipientPhone: phone,
    recipientName: name,
    type: 'sms',
    message,
    status,
  })
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schedule = getAvailabilityReminderSchedule()
  if (!schedule.isDue) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'Not the monthly reminder date',
      monthlyReminderDate: schedule.reminderDateLabel,
    })
  }

  const activeUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      roles: users.roles,
    })
    .from(users)
    .where(eq(users.active, true))

  const tasters = activeUsers.filter((user) =>
    user.role === 'taster' || user.roles.includes('taster'),
  )
  const availabilityUrl = getTasterAvailabilityUrl()
  const emailSubject = getAvailabilityReminderSubject(schedule.deadlineLabel)
  const smsMessage = getAvailabilityReminderSms(schedule.deadlineLabel, availabilityUrl)
  const results = {
    tasters: tasters.length,
    emailSent: 0,
    emailSkipped: 0,
    emailFailed: 0,
    smsSent: 0,
    smsSkipped: 0,
    smsFailed: 0,
    missingPhone: 0,
  }

  for (const taster of tasters) {
    if (await wasAlreadySent(taster.id, 'email', emailSubject)) {
      results.emailSkipped += 1
    } else {
      const emailSent = await sendTasterAvailabilityReminderEmail({
        to: taster.email,
        name: taster.name,
        deadlineLabel: schedule.deadlineLabel,
        availabilityUrl,
        userId: taster.id,
      })
      if (emailSent) results.emailSent += 1
      else results.emailFailed += 1
    }

    if (!taster.phone) {
      results.missingPhone += 1
      continue
    }

    if (await wasAlreadySent(taster.id, 'sms', smsMessage)) {
      results.smsSkipped += 1
      continue
    }

    try {
      await sendSms({
        to: taster.phone,
        body: smsMessage,
        userId: taster.id,
        contactName: taster.name,
      })
      await logSmsReminder({
        userId: taster.id,
        phone: taster.phone,
        name: taster.name,
        message: smsMessage,
        status: 'sent',
      })
      results.smsSent += 1
    } catch (error) {
      console.error(`Taster availability SMS failed for user ${taster.id}:`, error)
      await logSmsReminder({
        userId: taster.id,
        phone: taster.phone,
        name: taster.name,
        message: smsMessage,
        status: 'failed',
      })
      results.smsFailed += 1
    }
  }

  return NextResponse.json({
    ok: results.emailFailed === 0 && results.smsFailed === 0,
    period: schedule.periodKey,
    deadline: schedule.deadlineLabel,
    ...results,
  })
}
