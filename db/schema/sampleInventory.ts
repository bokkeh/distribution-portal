import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { invoices } from './invoices'
import { orders } from './orders'
import { products } from './products'
import { users } from './users'

export const SAMPLE_LOCATION_NAMES = [
  'Warehouse - Landover',
  'Kim - Samples Maryland',
  'Emily - Samples Chicago',
  'Kristen - Samples Kildeer',
] as const

export const QUICKBOOKS_SAMPLE_CATEGORIES = [
  'Tastings',
  'Events (IRL)',
  'Events (URL)',
  'Giveaways',
  'Charity Donations',
  'Sales Calls',
] as const

export type QuickBooksSampleCategory = (typeof QUICKBOOKS_SAMPLE_CATEGORIES)[number]

export const inventoryLocations = pgTable('inventory_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  type: text('type', { enum: ['warehouse', 'sample'] }).notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  region: text('region'),
  address: text('address'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const inventoryLocationBalances = pgTable('inventory_location_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => inventoryLocations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantityCases: integer('quantity_cases').notNull().default(0),
  quantityBottles: integer('quantity_bottles').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('inventory_location_balances_location_product_uidx').on(table.locationId, table.productId),
  index('inventory_location_balances_product_idx').on(table.productId),
])

export const inventoryLocationThresholds = pgTable('inventory_location_thresholds', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => inventoryLocations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  minimumCases: integer('minimum_cases').notNull().default(0),
  minimumBottles: integer('minimum_bottles').notNull().default(0),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex('inventory_location_thresholds_location_product_uidx').on(table.locationId, table.productId)])

export const sampleRequests = pgTable('sample_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestNumber: text('request_number').notNull().unique().default(sql`'SR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))`),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  status: text('status', { enum: ['draft', 'submitted', 'approved', 'fulfilled', 'partially_fulfilled', 'cancelled', 'reversed'] }).notNull().default('draft'),
  sourceLocationId: uuid('source_location_id').notNull().references(() => inventoryLocations.id),
  responsibleUserId: uuid('responsible_user_id').references(() => users.id, { onDelete: 'set null' }),
  recipientType: text('recipient_type', { enum: ['customer', 'prospect', 'event', 'charity', 'internal', 'other'] }).notNull(),
  recipientName: text('recipient_name').notNull(),
  recipientEmail: text('recipient_email'),
  recipientDetails: text('recipient_details'),
  quickBooksCategory: text('quickbooks_category', { enum: QUICKBOOKS_SAMPLE_CATEGORIES }).notNull(),
  customerAccountId: uuid('customer_account_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  purpose: text('purpose').notNull(),
  notes: text('notes'),
  replenishFromWarehouse: boolean('replenish_from_warehouse').notNull().default(false),
  totalEstimatedCost: numeric('total_estimated_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  requestedByUserId: uuid('requested_by_user_id').notNull().references(() => users.id),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  fulfilledByUserId: uuid('fulfilled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sample_requests_status_idx').on(table.status),
  index('sample_requests_source_location_idx').on(table.sourceLocationId),
  index('sample_requests_created_at_idx').on(table.createdAt),
])

export const sampleRequestItems = pgTable('sample_request_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sampleRequestId: uuid('sample_request_id').notNull().references(() => sampleRequests.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantityCases: integer('quantity_cases').notNull().default(0),
  quantityBottles: integer('quantity_bottles').notNull().default(0),
  estimatedUnitCost: numeric('estimated_unit_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  estimatedTotalCost: numeric('estimated_total_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('sample_request_items_request_product_uidx').on(table.sampleRequestId, table.productId),
])

export const sampleRequestStatusHistory = pgTable('sample_request_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  sampleRequestId: uuid('sample_request_id').notNull().references(() => sampleRequests.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  note: text('note'),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const inventoryLocationMovements = pgTable('inventory_location_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  type: text('type', { enum: ['opening_balance', 'adjustment', 'sample_usage', 'replenishment', 'transfer', 'return', 'reversal'] }).notNull(),
  productId: uuid('product_id').notNull().references(() => products.id),
  sourceLocationId: uuid('source_location_id').references(() => inventoryLocations.id),
  destinationLocationId: uuid('destination_location_id').references(() => inventoryLocations.id),
  quantityCases: integer('quantity_cases').notNull().default(0),
  quantityBottles: integer('quantity_bottles').notNull().default(0),
  sampleRequestId: uuid('sample_request_id').references(() => sampleRequests.id, { onDelete: 'set null' }),
  customerAccountId: uuid('customer_account_id').references(() => customerAccounts.id, { onDelete: 'set null' }),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  quickBooksCategory: text('quickbooks_category', { enum: QUICKBOOKS_SAMPLE_CATEGORIES }),
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  reason: text('reason').notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reversalOfMovementId: uuid('reversal_of_movement_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('inventory_location_movements_created_at_idx').on(table.createdAt),
  index('inventory_location_movements_product_idx').on(table.productId),
  index('inventory_location_movements_request_idx').on(table.sampleRequestId),
])

export const replenishmentRequests = pgTable('replenishment_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  sampleRequestId: uuid('sample_request_id').references(() => sampleRequests.id, { onDelete: 'set null' }),
  sourceLocationId: uuid('source_location_id').notNull().references(() => inventoryLocations.id),
  destinationLocationId: uuid('destination_location_id').notNull().references(() => inventoryLocations.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  requestedCases: integer('requested_cases').notNull().default(0),
  requestedBottles: integer('requested_bottles').notNull().default(0),
  fulfilledCases: integer('fulfilled_cases').notNull().default(0),
  fulfilledBottles: integer('fulfilled_bottles').notNull().default(0),
  status: text('status', { enum: ['requested', 'approved', 'partially_fulfilled', 'fulfilled', 'cancelled'] }).notNull().default('requested'),
  requestedByUserId: uuid('requested_by_user_id').notNull().references(() => users.id),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  fulfilledByUserId: uuid('fulfilled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
}, (table) => [index('replenishment_requests_status_idx').on(table.status)])

export const quickBooksCategoryMappings = pgTable('quickbooks_category_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category', { enum: QUICKBOOKS_SAMPLE_CATEGORIES }).notNull().unique(),
  accountId: text('account_id'),
  accountName: text('account_name'),
  classId: text('class_id'),
  className: text('class_name'),
  departmentId: text('department_id'),
  locationId: text('location_id'),
  customerProjectId: text('customer_project_id'),
  memoTemplate: text('memo_template'),
  autoExport: boolean('auto_export').notNull().default(false),
  requiresApproval: boolean('requires_approval').notNull().default(true),
  active: boolean('active').notNull().default(true),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const quickBooksExports = pgTable('quickbooks_exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  sampleRequestId: uuid('sample_request_id').notNull().references(() => sampleRequests.id, { onDelete: 'cascade' }).unique(),
  mappingId: uuid('mapping_id').references(() => quickBooksCategoryMappings.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['pending_mapping', 'pending_approval', 'ready', 'exported', 'failed', 'skipped'] }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  externalTransactionId: text('external_transaction_id'),
  attemptCount: integer('attempt_count').notNull().default(0),
  lastError: text('last_error'),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  exportedByUserId: uuid('exported_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  exportedAt: timestamp('exported_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('quickbooks_exports_status_idx').on(table.status)])

export const inventoryLowStockAlerts = pgTable('inventory_low_stock_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => inventoryLocations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['open', 'acknowledged', 'resolved'] }).notNull().default('open'),
  currentCases: integer('current_cases').notNull(),
  currentBottles: integer('current_bottles').notNull(),
  minimumCases: integer('minimum_cases').notNull(),
  minimumBottles: integer('minimum_bottles').notNull(),
  acknowledgedByUserId: uuid('acknowledged_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('inventory_low_stock_alerts_status_idx').on(table.status),
  index('inventory_low_stock_alerts_location_product_idx').on(table.locationId, table.productId),
])

export const monthlyInventoryReports = pgTable('monthly_inventory_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportMonth: text('report_month').notNull().unique(),
  status: text('status', { enum: ['generating', 'ready', 'sending', 'sent', 'partially_sent', 'failed'] }).notNull().default('generating'),
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
  csvContent: text('csv_content'),
  recipientEmails: text('recipient_emails').array().notNull().default(sql`ARRAY[]::text[]`),
  sentRecipientEmails: text('sent_recipient_emails').array().notNull().default(sql`ARRAY[]::text[]`),
  lastError: text('last_error'),
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

