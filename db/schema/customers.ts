import { pgTable, uuid, text, numeric, timestamp, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'

export const customerAccounts = pgTable('customer_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  phone: text('phone'),
  email: text('email'),
  businessType: text('business_type'),
  dcAbraNumber: text('dc_abra_number'),
  liquorLicenseNumber: text('liquor_license_number'),
  liquorLicenseState: text('liquor_license_state'),
  liquorLicenseExpiration: text('liquor_license_expiration'),
  liquorLicenseUrl: text('liquor_license_url'),
  hubspotContactId: text('hubspot_contact_id'),
  hubspotCompanyId: text('hubspot_company_id'),
  dealStage: text('deal_stage').default('new_lead'),
  starred: boolean('starred').notNull().default(false),
  // Extended profile fields (customer-editable)
  businessEmail: text('business_email'),
  businessPhone: text('business_phone'),
  notificationPreference: text('notification_preference').default('email'),
  pocName: text('poc_name'),
  pocPhone: text('poc_phone'),
  pocEmail: text('poc_email'),
  hoursOfOperation: text('hours_of_operation'),
  preferredDeliveryDays: text('preferred_delivery_days'),
  preferredDeliveryTimes: text('preferred_delivery_times'),
  additionalLocations: text('additional_locations'), // JSON: [{address,city,state,zip}]
  creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).notNull().default('0'),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  paymentTerms: text('payment_terms').default('NET30'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CustomerAccount = typeof customerAccounts.$inferSelect
export type NewCustomerAccount = typeof customerAccounts.$inferInsert
