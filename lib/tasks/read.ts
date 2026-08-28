import { and, asc, desc, eq, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { contacts, crmTasks, customerAccounts, users } from '@/db/schema'

export type TaskListItem = {
  id: string
  title: string
  description: string | null
  accountId: string | null
  accountName: string | null
  contactName: string | null
  assignedToUserId: string
  assigneeName: string
  createdByName: string
  dueAt: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  completedAt: string | null
}

export async function getTasksForView(input: {
  userId: string
  roles: string[]
  accountId?: string | null
  includeOrganization?: boolean
  limit?: number
}) {
  const canViewOrganization = input.roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
  const conditions = [
    ...(input.accountId ? [eq(crmTasks.accountId, input.accountId)] : []),
    ...(!input.includeOrganization || !canViewOrganization
      ? [or(eq(crmTasks.assignedToUserId, input.userId), eq(crmTasks.createdByUserId, input.userId))!]
      : []),
  ]
  const creator = alias(users, 'task_creator')
  const assignee = alias(users, 'task_assignee')
  const rows = await db.select({
    id: crmTasks.id,
    title: crmTasks.title,
    description: crmTasks.description,
    accountId: crmTasks.accountId,
    accountName: customerAccounts.companyName,
    contactName: contacts.name,
    assignedToUserId: crmTasks.assignedToUserId,
    assigneeName: assignee.name,
    createdByName: creator.name,
    dueAt: crmTasks.dueAt,
    priority: crmTasks.priority,
    status: crmTasks.status,
    completedAt: crmTasks.completedAt,
  })
    .from(crmTasks)
    .leftJoin(customerAccounts, eq(customerAccounts.id, crmTasks.accountId))
    .leftJoin(contacts, eq(contacts.id, crmTasks.contactId))
    .innerJoin(assignee, eq(assignee.id, crmTasks.assignedToUserId))
    .innerJoin(creator, eq(creator.id, crmTasks.createdByUserId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      asc(crmTasks.status),
      asc(crmTasks.dueAt),
      desc(crmTasks.createdAt),
    )
    .limit(input.limit ?? 200)

  return rows.map((row) => ({
    ...row,
    dueAt: row.dueAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  })) as TaskListItem[]
}

export function groupTasksByDueDate(tasks: TaskListItem[], now = new Date()) {
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const endToday = new Date(startToday)
  endToday.setDate(endToday.getDate() + 1)
  const active = tasks.filter((task) => !['completed', 'cancelled'].includes(task.status))
  return {
    overdue: active.filter((task) => new Date(task.dueAt) < startToday),
    today: active.filter((task) => new Date(task.dueAt) >= startToday && new Date(task.dueAt) < endToday),
    upcoming: active.filter((task) => new Date(task.dueAt) >= endToday),
    completed: tasks.filter((task) => task.status === 'completed'),
  }
}
