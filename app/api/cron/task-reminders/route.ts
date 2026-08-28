import { NextRequest, NextResponse } from 'next/server'
import { and, eq, gt, inArray, isNull, lte } from 'drizzle-orm'
import { db } from '@/db'
import { crmTasks, customerAccounts } from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'
import { sendTaskNotification, type TaskNotificationChannel } from '@/lib/tasks/notifications'

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const now = new Date()
  const activeStatuses = ['open', 'in_progress'] as const
  const candidates = await db.select({
    id: crmTasks.id,
    title: crmTasks.title,
    accountId: crmTasks.accountId,
    accountName: customerAccounts.companyName,
    assignedToUserId: crmTasks.assignedToUserId,
    dueAt: crmTasks.dueAt,
    reminderOffsetMinutes: crmTasks.reminderOffsetMinutes,
    notificationChannels: crmTasks.notificationChannels,
    reminderSentAt: crmTasks.reminderSentAt,
    overdueNotifiedAt: crmTasks.overdueNotifiedAt,
  }).from(crmTasks)
    .leftJoin(customerAccounts, eq(customerAccounts.id, crmTasks.accountId))
    .where(inArray(crmTasks.status, activeStatuses))

  let remindersSent = 0
  let overdueSent = 0
  let failed = 0

  for (const task of candidates) {
    const channels = task.notificationChannels.filter((channel): channel is TaskNotificationChannel => ['in-app', 'email', 'sms'].includes(channel))
    const accountLabel = task.accountName ? ` for ${task.accountName}` : ''
    const dueLabel = task.dueAt.toLocaleString()
    const reminderAt = task.reminderOffsetMinutes == null ? null : new Date(task.dueAt.getTime() - task.reminderOffsetMinutes * 60_000)
    const isReminderDue = reminderAt && reminderAt <= now && task.dueAt >= now && !task.reminderSentAt
    const isOverdue = task.dueAt < now && !task.overdueNotifiedAt

    try {
      if (isReminderDue) {
        const claimed = await db.update(crmTasks).set({ reminderSentAt: now, updatedAt: now })
          .where(and(eq(crmTasks.id, task.id), isNull(crmTasks.reminderSentAt), gt(crmTasks.dueAt, now)))
          .returning({ id: crmTasks.id })
        if (claimed.length) {
          const results = await sendTaskNotification({
            userId: task.assignedToUserId,
            kind: 'task_reminder',
            title: `Task reminder: ${task.title}`,
            body: `“${task.title}”${accountLabel} is due ${dueLabel}.`,
            taskId: task.id,
            channels,
          })
          if (results.some((result) => result.success)) {
            remindersSent++
            await logActivityEvent({ entityType: 'task', entityId: task.id, kind: 'task_reminder_sent', title: 'Task reminder sent', body: `Reminder sent for ${task.title}.`, metadata: { accountId: task.accountId, channels } })
          } else {
            await db.update(crmTasks).set({ reminderSentAt: null, updatedAt: new Date() }).where(eq(crmTasks.id, task.id))
            failed++
          }
        }
      }

      if (isOverdue) {
        const claimed = await db.update(crmTasks).set({ overdueNotifiedAt: now, updatedAt: now })
          .where(and(eq(crmTasks.id, task.id), isNull(crmTasks.overdueNotifiedAt), lte(crmTasks.dueAt, now)))
          .returning({ id: crmTasks.id })
        if (claimed.length) {
          const results = await sendTaskNotification({
            userId: task.assignedToUserId,
            kind: 'task_overdue',
            title: `Overdue task: ${task.title}`,
            body: `“${task.title}”${accountLabel} was due ${dueLabel}.`,
            taskId: task.id,
            channels,
          })
          if (results.some((result) => result.success)) {
            overdueSent++
            await logActivityEvent({ entityType: 'task', entityId: task.id, kind: 'task_overdue_notification_sent', title: 'Overdue notification sent', body: `${task.title} is overdue.`, metadata: { accountId: task.accountId, channels } })
          } else {
            await db.update(crmTasks).set({ overdueNotifiedAt: null, updatedAt: new Date() }).where(eq(crmTasks.id, task.id))
            failed++
          }
        }
      }
    } catch (error) {
      failed++
      console.error('[task-reminders] failed', { taskId: task.id, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return NextResponse.json({ candidates: candidates.length, remindersSent, overdueSent, failed })
}
