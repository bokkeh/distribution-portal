'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { contacts, crmTasks, customerAccounts, deliveries, deliveryStops, orders, salesMembers, tastings, users } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { sendTaskNotification, type TaskNotificationChannel } from '@/lib/tasks/notifications'

const TASK_ROLES = ['admin', 'staff', 'sales_rep', 'sales_manager'] as const
const taskInputSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required.').max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  orderId: z.string().uuid().optional().nullable(),
  deliveryId: z.string().uuid().optional().nullable(),
  tastingId: z.string().uuid().optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  dueAt: z.string().datetime({ offset: true }),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  reminderOffsetMinutes: z.number().int().min(0).max(525600).optional().nullable(),
  notificationChannels: z.array(z.enum(['in-app', 'email', 'sms'])).min(1).default(['in-app']),
})

export type CreateTaskInput = z.input<typeof taskInputSchema>

function revalidateTaskPaths(accountId?: string | null) {
  for (const path of ['/admin/tasks', '/staff/tasks', '/sales/tasks', '/admin/dashboard', '/staff/dashboard', '/sales/dashboard']) {
    revalidatePath(path)
  }
  if (accountId) {
    revalidatePath(`/admin/crm/${accountId}`)
    revalidatePath(`/staff/crm/${accountId}`)
    revalidatePath(`/sales/accounts/${accountId}`)
  }
}

async function assertAccountAccess(session: Awaited<ReturnType<typeof requireRole>>, accountId?: string | null) {
  if (!accountId) return null
  const roles = session.user.roles ?? [session.user.role as string]
  const [account] = await db.select({ id: customerAccounts.id, companyName: customerAccounts.companyName, assignedSalesRepId: customerAccounts.assignedSalesRepId })
    .from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
  if (!account) throw new Error('Account not found.')

  const isRepOnly = roles.includes('sales_rep') && !roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
  if (isRepOnly) {
    const [member] = await db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1)
    if (!member || account.assignedSalesRepId !== member.id) throw new Error('You are not assigned to this account.')
  }
  return account
}

export async function createTask(input: CreateTaskInput) {
  try {
    const session = await requireRole(...TASK_ROLES)
    const parsed = taskInputSchema.parse(input)
    const roles = session.user.roles ?? [session.user.role as string]
    const account = await assertAccountAccess(session, parsed.accountId)
    const canAssignOthers = roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
    const assignedToUserId = canAssignOthers && parsed.assignedToUserId ? parsed.assignedToUserId : session.user.id

    const [assignee] = await db.select({ id: users.id, name: users.name, roles: users.roles, active: users.active })
      .from(users).where(eq(users.id, assignedToUserId)).limit(1)
    if (!assignee?.active || !assignee.roles.some((role) => TASK_ROLES.includes(role as typeof TASK_ROLES[number]))) {
      throw new Error('Choose an eligible active assignee.')
    }

    if (parsed.contactId) {
      const [contact] = await db.select({ customerId: contacts.customerId }).from(contacts).where(eq(contacts.id, parsed.contactId)).limit(1)
      if (!contact || !parsed.accountId || contact.customerId !== parsed.accountId) {
        throw new Error('The related person must belong to the selected account.')
      }
    }
    if (parsed.orderId) {
      const [relatedOrder] = await db.select({ accountId: orders.customerId }).from(orders).where(eq(orders.id, parsed.orderId)).limit(1)
      if (!relatedOrder || !parsed.accountId || relatedOrder.accountId !== parsed.accountId) throw new Error('The related order must belong to the selected account.')
    }
    if (parsed.tastingId) {
      const [relatedTasting] = await db.select({ accountId: tastings.customerId }).from(tastings).where(eq(tastings.id, parsed.tastingId)).limit(1)
      if (!relatedTasting || !parsed.accountId || relatedTasting.accountId !== parsed.accountId) throw new Error('The related tasting must belong to the selected account.')
    }
    if (parsed.deliveryId) {
      if (!parsed.accountId) throw new Error('Choose an account before linking a delivery.')
      const [relatedDelivery] = await db.select({ id: deliveries.id }).from(deliveries)
        .innerJoin(deliveryStops, eq(deliveryStops.deliveryId, deliveries.id))
        .where(and(eq(deliveries.id, parsed.deliveryId), eq(deliveryStops.customerId, parsed.accountId))).limit(1)
      if (!relatedDelivery) throw new Error('The related delivery must belong to the selected account.')
    }

    const dueAt = new Date(parsed.dueAt)
    if (Number.isNaN(dueAt.getTime())) throw new Error('Choose a valid due date and time.')

    const [task] = await db.insert(crmTasks).values({
      title: parsed.title,
      description: parsed.description || null,
      accountId: parsed.accountId || null,
      contactId: parsed.contactId || null,
      orderId: parsed.orderId || null,
      deliveryId: parsed.deliveryId || null,
      tastingId: parsed.tastingId || null,
      createdByUserId: session.user.id,
      assignedToUserId,
      dueAt,
      priority: parsed.priority,
      reminderOffsetMinutes: parsed.reminderOffsetMinutes ?? null,
      notificationChannels: parsed.notificationChannels,
    }).returning()

    await logActivityEvent({
      entityType: 'task',
      entityId: task.id,
      actorUserId: session.user.id,
      relatedUserId: assignedToUserId,
      kind: 'task_created',
      title: 'Task created',
      body: `${parsed.title}${account ? ` for ${account.companyName}` : ''}.`,
      metadata: { accountId: parsed.accountId, dueAt: dueAt.toISOString(), priority: parsed.priority },
    })

    if (assignedToUserId !== session.user.id) {
      await sendTaskNotification({
        userId: assignedToUserId,
        kind: 'task_assigned',
        title: `New task: ${parsed.title}`,
        body: `${session.user.name ?? 'A teammate'} assigned you “${parsed.title}”${account ? ` for ${account.companyName}` : ''}, due ${dueAt.toLocaleString()}.`,
        taskId: task.id,
        channels: parsed.notificationChannels as TaskNotificationChannel[],
      })
    }

    revalidateTaskPaths(parsed.accountId)
    return { success: true as const, taskId: task.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create task.' }
  }
}

export async function updateTaskStatus(taskId: string, status: 'open' | 'in_progress' | 'completed' | 'cancelled') {
  try {
    const session = await requireRole(...TASK_ROLES)
    const roles = session.user.roles ?? [session.user.role as string]
    const [task] = await db.select().from(crmTasks).where(eq(crmTasks.id, taskId)).limit(1)
    if (!task) throw new Error('Task not found.')
    const canManageAny = roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
    if (!canManageAny && task.assignedToUserId !== session.user.id && task.createdByUserId !== session.user.id) {
      throw new Error('You cannot update this task.')
    }

    const now = new Date()
    await db.update(crmTasks).set({
      status,
      completedAt: status === 'completed' ? now : null,
      updatedAt: now,
    }).where(and(eq(crmTasks.id, taskId), eq(crmTasks.status, task.status)))

    await logActivityEvent({
      entityType: 'task', entityId: task.id, actorUserId: session.user.id,
      kind: status === 'completed' ? 'task_completed' : 'task_status_changed',
      title: status === 'completed' ? 'Task completed' : 'Task status updated',
      body: `${task.title} is now ${status.replace('_', ' ')}.`,
      metadata: { accountId: task.accountId, previousStatus: task.status, status },
    })
    revalidateTaskPaths(task.accountId)
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to update task.' }
  }
}

export async function updateTaskDetails(input: {
  taskId: string
  title: string
  description?: string
  assignedToUserId: string
  dueAt: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}) {
  try {
    const session = await requireRole(...TASK_ROLES)
    const roles = session.user.roles ?? [session.user.role as string]
    const [task] = await db.select().from(crmTasks).where(eq(crmTasks.id, input.taskId)).limit(1)
    if (!task) throw new Error('Task not found.')
    const canManageAny = roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
    if (!canManageAny && task.assignedToUserId !== session.user.id && task.createdByUserId !== session.user.id) throw new Error('You cannot edit this task.')

    const title = input.title.trim()
    const dueAt = new Date(input.dueAt)
    if (!title) throw new Error('Task title is required.')
    if (Number.isNaN(dueAt.getTime())) throw new Error('Choose a valid due date and time.')
    const assignedToUserId = canManageAny ? input.assignedToUserId : task.assignedToUserId
    const [assignee] = await db.select({ id: users.id, active: users.active, roles: users.roles }).from(users).where(eq(users.id, assignedToUserId)).limit(1)
    if (!assignee?.active || !assignee.roles.some((role) => TASK_ROLES.includes(role as typeof TASK_ROLES[number]))) throw new Error('Choose an eligible active assignee.')

    await db.update(crmTasks).set({
      title,
      description: optionalString(input.description),
      assignedToUserId,
      dueAt,
      priority: input.priority,
      reminderSentAt: task.dueAt.getTime() === dueAt.getTime() ? task.reminderSentAt : null,
      overdueNotifiedAt: task.dueAt.getTime() === dueAt.getTime() ? task.overdueNotifiedAt : null,
      updatedAt: new Date(),
    }).where(eq(crmTasks.id, task.id))

    await logActivityEvent({
      entityType: 'task', entityId: task.id, actorUserId: session.user.id, relatedUserId: assignedToUserId,
      kind: 'task_updated', title: 'Task updated', body: `${title} was updated.`, metadata: { accountId: task.accountId, dueAt: dueAt.toISOString(), priority: input.priority },
    })
    if (assignedToUserId !== task.assignedToUserId && assignedToUserId !== session.user.id) {
      await sendTaskNotification({
        userId: assignedToUserId, kind: 'task_assigned', title: `New task: ${title}`,
        body: `${session.user.name ?? 'A teammate'} assigned you “${title}”, due ${dueAt.toLocaleString()}.`,
        taskId: task.id,
        channels: task.notificationChannels.filter((channel): channel is TaskNotificationChannel => ['in-app', 'email', 'sms'].includes(channel)),
      })
    }
    revalidateTaskPaths(task.accountId)
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to update task.' }
  }
}

function optionalString(value?: string | null) {
  return value?.trim() || null
}
