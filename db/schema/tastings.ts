import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { products } from './products'
import { users } from './users'

export const TASTING_OBJECTIVES = ['sell_through', 'reorder', 'account_opening', 'strategic'] as const
export type TastingObjectiveValue = (typeof TASTING_OBJECTIVES)[number]

export const tastings = pgTable('tastings', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  assignedUserId: uuid('assigned_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventName: text('event_name').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  status: text('status', { enum: ['requested', 'scheduled', 'confirmed', 'completed', 'cancelled', 'declined'] }).notNull().default('scheduled'),
  storeAddress: text('store_address'),
  storeCity: text('store_city'),
  storeState: text('store_state'),
  storeZip: text('store_zip'),
  storePhone: text('store_phone'),
  trainingDay: boolean('training_day').notNull().default(false),
  notes: text('notes'),

  // Required when status is set to 'cancelled' via the taster-facing cancellation flow.
  cancellationReason: text('cancellation_reason', {
    enum: ['sick_emergency', 'schedule_conflict', 'venue_cancelled', 'weather', 'transportation', 'no_longer_available', 'other'],
  }),
  cancellationNote: text('cancellation_note'),

  // Why the tasting was booked and what it must achieve. Required for new tastings;
  // null on tastings scheduled before objectives existed.
  objective: text('objective', { enum: TASTING_OBJECTIVES }),
  primaryGoal: text('primary_goal'),
  targetBottlesSold: integer('target_bottles_sold'),
  targetCasesDepleted: numeric('target_cases_depleted', { precision: 10, scale: 2 }),
  targetReorderQuantity: integer('target_reorder_quantity'),
  /** Per-tasting cost estimate; the taster invoice replaces it once submitted. */
  estimatedCost: numeric('estimated_cost', { precision: 10, scale: 2 }),
  tasterPay: numeric('taster_pay', { precision: 10, scale: 2 }),
  expectedRoi: text('expected_roi'),
  // Strategic tastings only.
  strategicReason: text('strategic_reason'),
  expectedOutcome: text('expected_outcome'),
  estimatedValue: numeric('estimated_value', { precision: 12, scale: 2 }),
  followUpAction: text('follow_up_action'),
  resultAfterEvent: text('result_after_event'),
  /** What the decision panel said when this was scheduled, and who accepted a warning. */
  decisionAtScheduling: text('decision_at_scheduling', { enum: ['recommended', 'consider', 'not_recommended'] }),
  decisionAcknowledgedByUserId: uuid('decision_acknowledged_by_user_id').references(() => users.id, { onDelete: 'set null' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Global tasting-economics assumptions. One row; edited by admins and overridable per
 * tasting (estimated cost) so nothing here is hard-coded in the metrics.
 */
export const tastingEconomicsSettings = pgTable('tasting_economics_settings', {
  id: text('id').primaryKey().default('global'),
  contributionPerCase: numeric('contribution_per_case', { precision: 10, scale: 2 }).notNull().default('75'),
  defaultTastingCost: numeric('default_tasting_cost', { precision: 10, scale: 2 }).notNull().default('90'),
  attributionWindowDays: integer('attribution_window_days').notNull().default(14),
  /** 0..1 — share of the prior order a tasting must sell to be credited beyond the window. */
  assistedSalesShare: numeric('assisted_sales_share', { precision: 4, scale: 2 }).notNull().default('0.5'),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TastingEconomicsSettingsRow = typeof tastingEconomicsSettings.$inferSelect

export const tastingProducts = pgTable('tasting_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  tastingId: uuid('tasting_id').notNull().references(() => tastings.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  plannedQuantity: numeric('planned_quantity', { precision: 10, scale: 2 }).notNull().default('0'),
  startingInventory: jsonb('starting_inventory').$type<{ cases?: number; bottles?: number; units?: number }>().notNull().default({}),
  unitsSold: integer('units_sold').notNull().default(0),
  revenueGenerated: numeric('revenue_generated', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('tasting_products_tasting_idx').on(table.tastingId),
  index('tasting_products_product_idx').on(table.productId),
])

export type Tasting = typeof tastings.$inferSelect
export type NewTasting = typeof tastings.$inferInsert
export type TastingProduct = typeof tastingProducts.$inferSelect
export type NewTastingProduct = typeof tastingProducts.$inferInsert
