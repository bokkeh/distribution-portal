import { boolean, index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { products } from './products'
import { users } from './users'
import { customerAccounts } from './customers'

export const geographicPricingRules = pgTable('geographic_pricing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  stateCode: text('state_code'),
  countyName: text('county_name'),
  countyKey: text('county_key'),
  accountId: uuid('account_id').references(() => customerAccounts.id, { onDelete: 'cascade' }),
  businessType: text('business_type'),
  ruleType: text('rule_type', { enum: ['state', 'county', 'account', 'business_type'] }).notNull(),
  minCaseQuantity: integer('min_case_quantity'),
  maxCaseQuantity: integer('max_case_quantity'),
  casePrice: numeric('case_price', { precision: 10, scale: 2 }).notNull(),
  effectiveStartDate: timestamp('effective_start_date', { withTimezone: true }).notNull(),
  effectiveEndDate: timestamp('effective_end_date', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  productStateIdx: index('geographic_pricing_rules_product_state_idx').on(table.productId, table.stateCode),
  countyLookupIdx: index('geographic_pricing_rules_county_lookup_idx').on(table.stateCode, table.countyKey),
  accountLookupIdx: index('geographic_pricing_rules_account_lookup_idx').on(table.accountId, table.productId),
  businessTypeLookupIdx: index('geographic_pricing_rules_business_type_lookup_idx').on(table.businessType, table.productId),
  activeWindowIdx: index('geographic_pricing_rules_active_window_idx').on(table.isActive, table.effectiveStartDate, table.effectiveEndDate),
}))

export type GeographicPricingRule = typeof geographicPricingRules.$inferSelect
export type NewGeographicPricingRule = typeof geographicPricingRules.$inferInsert
