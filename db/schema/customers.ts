import { pgTable, uuid, text, numeric, timestamp, boolean, integer, doublePrecision } from 'drizzle-orm/pg-core'
import { users } from './users'
import { salesMembers } from './salesMembers'
import { salesRegions } from './salesRegions'

export const customerAccounts = pgTable('customer_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  contactName: text('contact_name'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  county: text('county'),
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
  notificationPhone: text('notification_phone'),
  pocName: text('poc_name'),
  pocPhone: text('poc_phone'),
  pocEmail: text('poc_email'),
  hoursOfOperation: text('hours_of_operation'),
  preferredDeliveryDays: text('preferred_delivery_days'),
  preferredDeliveryTimes: text('preferred_delivery_times'),
  additionalLocations: text('additional_locations'), // JSON: [{address,city,state,zip}]
  website: text('website'),
  creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).notNull().default('0'),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  paymentTerms: text('payment_terms').default('PREPAID'),
  customerSegment: text('customer_segment', { enum: ['b2b_wholesale', 'b2c_consumer'] }).notNull().default('b2b_wholesale'),
  customerSource: text('customer_source'),
  sourceExternalId: text('source_external_id'),
  // Sales assignment
  assignedSalesRepId: uuid('assigned_sales_rep_id').references(() => salesMembers.id, { onDelete: 'set null' }),
  assignedRegionId: uuid('assigned_region_id').references(() => salesRegions.id, { onDelete: 'set null' }),
  accountPriority: text('account_priority', { enum: ['high', 'medium', 'low'] }).default('medium'),
  accountType: text('account_type', { enum: ['on_premise', 'off_premise', 'chain', 'independent'] }),
  visitFrequency: integer('visit_frequency').default(30), // days between required visits
  lastVisitDate: timestamp('last_visit_date', { withTimezone: true }),
  nextRequiredVisitDate: timestamp('next_required_visit_date', { withTimezone: true }),
  // Geocoded coordinates (cached from address)
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type CustomerAccount = typeof customerAccounts.$inferSelect
export type NewCustomerAccount = typeof customerAccounts.$inferInsert
