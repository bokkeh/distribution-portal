import { sql } from 'drizzle-orm'
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { contacts } from './contacts'
import { customerAccounts } from './customers'
import { deliveries } from './deliveries'
import { orders } from './orders'
import { tastings } from './tastings'
import { users } from './users'

export const CRM_TASK_STATUSES = ['open', 'in_progress', 'completed', 'cancelled'] as const
export const CRM_TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const

export const crmTasks = pgTable('crm_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  accountId: uuid('account_id').references(() => customerAccounts.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  deliveryId: uuid('delivery_id').references(() => deliveries.id, { onDelete: 'set null' }),
  tastingId: uuid('tasting_id').references(() => tastings.id, { onDelete: 'set null' }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  assignedToUserId: uuid('assigned_to_user_id').notNull().references(() => users.id),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  priority: text('priority', { enum: CRM_TASK_PRIORITIES }).notNull().default('normal'),
  status: text('status', { enum: CRM_TASK_STATUSES }).notNull().default('open'),
  reminderOffsetMinutes: integer('reminder_offset_minutes'),
  notificationChannels: text('notification_channels').array().notNull().default(sql`ARRAY['in-app']::text[]`),
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  overdueNotifiedAt: timestamp('overdue_notified_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('crm_tasks_account_idx').on(table.accountId, table.dueAt),
  index('crm_tasks_assignee_due_idx').on(table.assignedToUserId, table.dueAt),
  index('crm_tasks_status_due_idx').on(table.status, table.dueAt),
  index('crm_tasks_tasting_idx').on(table.tastingId),
])

export type CrmTask = typeof crmTasks.$inferSelect
export type NewCrmTask = typeof crmTasks.$inferInsert
