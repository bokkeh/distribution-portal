import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userPreferences, users } from '@/db/schema'
import { createUserNotification } from '@/lib/notifications/in-app'
import { sendInternalAlertEmail } from '@/lib/resend/client'
import { sendSms } from '@/lib/telnyx/client'

export type TaskNotificationChannel = 'in-app' | 'email' | 'sms'

export function getTaskHref(roles: string[], taskId: string) {
  if (roles.includes('admin')) return `/admin/tasks?task=${taskId}#task-${taskId}`
  if (roles.includes('staff')) return `/staff/tasks?task=${taskId}#task-${taskId}`
  return `/sales/tasks?task=${taskId}#task-${taskId}`
}

export async function sendTaskNotification(input: {
  userId: string
  kind: 'task_assigned' | 'task_reminder' | 'task_overdue'
  title: string
  body: string
  taskId: string
  channels: TaskNotificationChannel[]
}) {
  const [recipient] = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      roles: users.roles,
      active: users.active,
      emailEnabled: userPreferences.emailNotificationsEnabled,
      smsEnabled: userPreferences.smsNotificationsEnabled,
      inAppEnabled: userPreferences.inAppNotificationsEnabled,
    })
    .from(users)
    .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
    .where(eq(users.id, input.userId))
    .limit(1)

  if (!recipient?.active) return []
  const href = getTaskHref(recipient.roles, input.taskId)
  const work: Array<Promise<{ channel: TaskNotificationChannel; success: boolean }>> = []

  if (input.channels.includes('in-app') && (recipient.inAppEnabled ?? true)) {
    work.push(createUserNotification({
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href,
    }).then(() => ({ channel: 'in-app' as const, success: true })))
  }

  if (input.channels.includes('email') && (recipient.emailEnabled ?? true) && recipient.email) {
    work.push(sendInternalAlertEmail({
      to: [recipient.email],
      subject: input.title,
      title: input.title,
      body: input.body,
      href,
    }).then(() => ({ channel: 'email' as const, success: true })))
  }

  if (input.channels.includes('sms') && (recipient.smsEnabled ?? true) && recipient.phone) {
    work.push(sendSms({
      to: recipient.phone,
      body: `CRM: ${input.body}`.slice(0, 320),
      userId: input.userId,
      contactName: recipient.name,
    }).then(() => ({ channel: 'sms' as const, success: true })))
  }

  const results = await Promise.allSettled(work)
  return results.map((result) => result.status === 'fulfilled'
    ? result.value
    : ({ channel: 'in-app' as const, success: false }))
}
