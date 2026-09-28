import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Team Progression (Wisher Vodka rank ladder).
 *
 * The ten ranks themselves are a fixed ladder defined in code (`lib/progression/ranks.ts`),
 * matching the spec's literal level/name/career-stage table. Only STATE and ADMIN-EDITABLE
 * CONFIG live in the database here:
 *   - requirements per rank (admin-editable, optionally scoped by market/region)
 *   - the assignment log (current rank = latest row per user; doubles as audit history)
 *   - starter kit checklist config + per-user completion
 *   - manual/override completion of a requirement that has no computed source
 *   - promotion recommendations awaiting admin approval
 *   - training sessions (drives "team members trained" / "training sessions completed")
 *   - scheduled/requested rank reviews
 *
 * Performance numbers (tastings completed, bottles/cases sold, accounts opened, reorders
 * influenced, reporting completion, reliability) are computed on read from existing tables
 * (tastings, tasting_reports, orders, order_items, customer_accounts) in
 * `lib/progression/metrics.ts` — no metrics are duplicated into this schema.
 */

export const PROGRESSION_REQUIREMENT_TYPES = ['required', 'recommended', 'optional', 'not_applicable'] as const
export type ProgressionRequirementType = (typeof PROGRESSION_REQUIREMENT_TYPES)[number]

export const progressionRankRequirements = pgTable('progression_rank_requirements', {
  id: uuid('id').primaryKey().defaultRandom(),
  level: integer('level').notNull(),
  /** null = applies to every market/territory; otherwise matched against the member's home region. */
  market: text('market'),
  /** Standard key (e.g. "min_tastings") or "custom:<slug>" for an admin-added qualitative item. */
  key: text('key').notNull(),
  label: text('label').notNull(),
  requirementType: text('requirement_type', { enum: PROGRESSION_REQUIREMENT_TYPES }).notNull().default('required'),
  /** Numeric threshold for computed keys (e.g. minimum tastings, minimum days). */
  targetNumeric: numeric('target_numeric', { precision: 12, scale: 2 }),
  /** True for requirements with no computed data source (must be manually marked/overridden). */
  isQualitative: boolean('is_qualitative').notNull().default(false),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('progression_rank_requirements_scope_key').on(table.level, table.market, table.key),
  index('progression_rank_requirements_level_idx').on(table.level),
])

export const PROGRESSION_CHANGE_TYPES = ['initial', 'promotion', 'demotion', 'correction', 'temporary', 'scheduled_review'] as const
export type ProgressionChangeType = (typeof PROGRESSION_CHANGE_TYPES)[number]

/**
 * One row per rank change. The current rank for a user is the row with the latest
 * `effectiveAt` — this table is simultaneously live state and the audit/promotion history.
 */
export const progressionRankAssignments = pgTable('progression_rank_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  level: integer('level').notNull(),
  previousLevel: integer('previous_level'),
  changeType: text('change_type', { enum: PROGRESSION_CHANGE_TYPES }).notNull().default('promotion'),
  isTemporary: boolean('is_temporary').notNull().default(false),
  temporaryUntil: timestamp('temporary_until', { withTimezone: true }),
  reason: text('reason').notNull(),
  notes: text('notes'),
  /** Requirement keys the admin explicitly waived to make this change, with why. */
  overriddenRequirements: jsonb('overridden_requirements').$type<{ key: string; reason: string }[]>().default([]),
  assignedByUserId: uuid('assigned_by_user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('progression_rank_assignments_user_idx').on(table.userId, table.effectiveAt),
])

export const progressionStarterKitItems = pgTable('progression_starter_kit_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label').notNull(),
  description: text('description'),
  /** Certifications/documents can expire; completions of this item may carry an expiry date. */
  tracksExpiry: boolean('tracks_expiry').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const progressionStarterKitCompletions = pgTable('progression_starter_kit_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => progressionStarterKitItems.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedByUserId: uuid('completed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('progression_starter_kit_completions_user_item').on(table.userId, table.itemId),
])

export const PROGRESSION_REQUIREMENT_COMPLETION_STATUSES = ['complete', 'overridden'] as const

/** Manual completion/override for a requirement with no computed source (or an admin waiver). */
export const progressionRequirementCompletions = pgTable('progression_requirement_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  level: integer('level').notNull(),
  requirementKey: text('requirement_key').notNull(),
  status: text('status', { enum: PROGRESSION_REQUIREMENT_COMPLETION_STATUSES }).notNull().default('complete'),
  reason: text('reason'),
  markedByUserId: uuid('marked_by_user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('progression_requirement_completions_user_idx').on(table.userId, table.level),
])

export const PROGRESSION_RECOMMENDATION_STATUSES = ['recommended', 'approved', 'declined', 'superseded'] as const

export const progressionPromotionRecommendations = pgTable('progression_promotion_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fromLevel: integer('from_level').notNull(),
  toLevel: integer('to_level').notNull(),
  status: text('status', { enum: PROGRESSION_RECOMMENDATION_STATUSES }).notNull().default('recommended'),
  recommendedByUserId: uuid('recommended_by_user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  recommendedReason: text('recommended_reason'),
  decidedByUserId: uuid('decided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decisionNotes: text('decision_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('progression_promotion_recommendations_user_idx').on(table.userId, table.status),
])

export const progressionTrainingRecords = pgTable('progression_training_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  trainerUserId: uuid('trainer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  traineeUserId: uuid('trainee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  sessionDate: timestamp('session_date', { withTimezone: true }).notNull(),
  notes: text('notes'),
  recordedByUserId: uuid('recorded_by_user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('progression_training_records_trainer_idx').on(table.trainerUserId),
  index('progression_training_records_trainee_idx').on(table.traineeUserId),
])

export const PROGRESSION_REVIEW_STATUSES = ['scheduled', 'completed', 'cancelled'] as const

export const progressionReviews = pgTable('progression_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  requestedByUserId: uuid('requested_by_user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason'),
  status: text('status', { enum: PROGRESSION_REVIEW_STATUSES }).notNull().default('scheduled'),
  completedByUserId: uuid('completed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  outcomeNotes: text('outcome_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('progression_reviews_user_idx').on(table.userId, table.status),
])

export type ProgressionRankRequirement = typeof progressionRankRequirements.$inferSelect
export type NewProgressionRankRequirement = typeof progressionRankRequirements.$inferInsert
export type ProgressionRankAssignment = typeof progressionRankAssignments.$inferSelect
export type NewProgressionRankAssignment = typeof progressionRankAssignments.$inferInsert
export type ProgressionStarterKitItem = typeof progressionStarterKitItems.$inferSelect
export type NewProgressionStarterKitItem = typeof progressionStarterKitItems.$inferInsert
export type ProgressionStarterKitCompletion = typeof progressionStarterKitCompletions.$inferSelect
export type NewProgressionStarterKitCompletion = typeof progressionStarterKitCompletions.$inferInsert
export type ProgressionRequirementCompletion = typeof progressionRequirementCompletions.$inferSelect
export type NewProgressionRequirementCompletion = typeof progressionRequirementCompletions.$inferInsert
export type ProgressionPromotionRecommendation = typeof progressionPromotionRecommendations.$inferSelect
export type NewProgressionPromotionRecommendation = typeof progressionPromotionRecommendations.$inferInsert
export type ProgressionTrainingRecord = typeof progressionTrainingRecords.$inferSelect
export type NewProgressionTrainingRecord = typeof progressionTrainingRecords.$inferInsert
export type ProgressionReview = typeof progressionReviews.$inferSelect
export type NewProgressionReview = typeof progressionReviews.$inferInsert
