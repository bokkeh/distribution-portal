import { date, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { customerAccounts } from './customers'
import { products } from './products'
import { users } from './users'

export const accountPriceHistory = pgTable('account_price_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => customerAccounts.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  observedOn: date('observed_on').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true }),
  timeZone: text('time_zone').notNull().default('America/New_York'),
  currency: text('currency').notNull().default('USD'),
  priceType: text('price_type', { enum: ['regular', 'promotional', 'unspecified'] }).notNull().default('unspecified'),
  productSize: text('product_size'),
  notes: text('notes'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  accountProductDateIdx: index('account_price_history_account_product_date_idx').on(table.accountId, table.productId, table.observedOn),
}))
