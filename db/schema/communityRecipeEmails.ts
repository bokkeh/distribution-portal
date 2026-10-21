import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/**
 * One row per weekly Wisher cocktail email sent to subscribed community contacts.
 * The recent rows drive recipe rotation so a recipe never repeats within the last 5 sends.
 */
export const communityRecipeEmails = pgTable('community_recipe_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Monday of the send week in Eastern time (YYYY-MM-DD); unique so cron retries never double-send. */
  weekKey: text('week_key').notNull(),
  recipeHandle: text('recipe_handle').notNull(),
  recipeTitle: text('recipe_title').notNull(),
  recipeUrl: text('recipe_url').notNull(),
  subject: text('subject').notNull(),
  status: text('status', { enum: ['sending', 'sent', 'failed'] }).notNull().default('sending'),
  recipientCount: integer('recipient_count').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('community_recipe_emails_week_uidx').on(table.weekKey),
  index('community_recipe_emails_created_idx').on(table.createdAt),
])

export type CommunityRecipeEmail = typeof communityRecipeEmails.$inferSelect
