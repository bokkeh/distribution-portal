import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'

export type CRMAccountDetail = {
  id: string
  userId: string | null
  companyName: string
  contactName: string | null
  address: string | null
  city: string | null
  state: string | null
  county: string | null
  zip: string | null
  phone: string | null
  email: string | null
  businessType: string | null
  dcAbraNumber: string | null
  liquorLicenseNumber: string | null
  liquorLicenseState: string | null
  liquorLicenseExpiration: string | null
  liquorLicenseUrl: string | null
  hubspotContactId: string | null
  hubspotCompanyId: string | null
  dealStage: string | null
  starred: boolean
  businessEmail: string | null
  businessPhone: string | null
  notificationPreference: string | null
  notificationPhone: string | null
  pocName: string | null
  pocPhone: string | null
  pocEmail: string | null
  hoursOfOperation: string | null
  preferredDeliveryDays: string | null
  preferredDeliveryTimes: string | null
  additionalLocations: string | null
  creditLimit: string
  balance: string
  paymentTerms: string | null
  assignedRegionId: string | null
  lat: number | null
  lng: number | null
  createdAt: Date
}

const DEFAULT_ACCOUNT_DETAIL = {
  businessType: null,
  dcAbraNumber: null,
  liquorLicenseNumber: null,
  liquorLicenseState: null,
  liquorLicenseExpiration: null,
  liquorLicenseUrl: null,
  hubspotContactId: null,
  hubspotCompanyId: null,
  dealStage: 'new_lead',
  starred: false,
  businessEmail: null,
  businessPhone: null,
  notificationPreference: 'email',
  notificationPhone: null,
  pocName: null,
  pocPhone: null,
  pocEmail: null,
  hoursOfOperation: null,
  preferredDeliveryDays: null,
  preferredDeliveryTimes: null,
  additionalLocations: null,
  assignedRegionId: null,
  lat: null,
  lng: null,
}

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
}

function isMissingCustomerAccountsColumn(error: unknown) {
  const message = getErrorText(error)
  return message.includes('customer_accounts') && (message.includes('does not exist') || message.includes('column'))
}

async function getCustomerAccountColumns() {
  const rows = await db.execute(sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customer_accounts'
  `)

  return new Set(
    rows.rows
      .map((row) => {
        const value = row as Record<string, unknown>
        return typeof value.column_name === 'string' ? value.column_name : null
      })
      .filter((columnName): columnName is string => Boolean(columnName))
  )
}

export async function getCRMAccountDetail(accountId: string): Promise<CRMAccountDetail | null> {
  try {
    const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
    return account ?? null
  } catch (error) {
    if (!isMissingCustomerAccountsColumn(error)) throw error
  }

  const availableColumns = await getCustomerAccountColumns()
  const [baseAccount] = await db.select({
    id: customerAccounts.id,
    userId: customerAccounts.userId,
    companyName: customerAccounts.companyName,
    contactName: customerAccounts.contactName,
    address: customerAccounts.address,
    city: customerAccounts.city,
    state: customerAccounts.state,
    county: customerAccounts.county,
    zip: customerAccounts.zip,
    phone: customerAccounts.phone,
    email: customerAccounts.email,
    creditLimit: customerAccounts.creditLimit,
    balance: customerAccounts.balance,
    paymentTerms: customerAccounts.paymentTerms,
    assignedRegionId: customerAccounts.assignedRegionId,
    lat: customerAccounts.lat,
    lng: customerAccounts.lng,
    createdAt: customerAccounts.createdAt,
  }).from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)

  if (!baseAccount) return null

  const fallbackAccount: CRMAccountDetail = {
    ...baseAccount,
    ...DEFAULT_ACCOUNT_DETAIL,
  }

  if (!availableColumns.size) return fallbackAccount

  const optionalFields: Array<keyof typeof DEFAULT_ACCOUNT_DETAIL> = [
    'businessType',
    'dcAbraNumber',
    'liquorLicenseNumber',
    'liquorLicenseState',
    'liquorLicenseExpiration',
    'liquorLicenseUrl',
    'hubspotContactId',
    'hubspotCompanyId',
    'dealStage',
    'starred',
    'businessEmail',
    'businessPhone',
    'notificationPreference',
    'notificationPhone',
    'pocName',
    'pocPhone',
    'pocEmail',
    'hoursOfOperation',
    'preferredDeliveryDays',
    'preferredDeliveryTimes',
    'additionalLocations',
    'assignedRegionId',
    'lat',
    'lng',
  ]

  const columnMap: Record<(typeof optionalFields)[number], string> = {
    businessType: 'business_type',
    dcAbraNumber: 'dc_abra_number',
    liquorLicenseNumber: 'liquor_license_number',
    liquorLicenseState: 'liquor_license_state',
    liquorLicenseExpiration: 'liquor_license_expiration',
    liquorLicenseUrl: 'liquor_license_url',
    hubspotContactId: 'hubspot_contact_id',
    hubspotCompanyId: 'hubspot_company_id',
    dealStage: 'deal_stage',
    starred: 'starred',
    businessEmail: 'business_email',
    businessPhone: 'business_phone',
    notificationPreference: 'notification_preference',
    notificationPhone: 'notification_phone',
    pocName: 'poc_name',
    pocPhone: 'poc_phone',
    pocEmail: 'poc_email',
    hoursOfOperation: 'hours_of_operation',
    preferredDeliveryDays: 'preferred_delivery_days',
    preferredDeliveryTimes: 'preferred_delivery_times',
    additionalLocations: 'additional_locations',
    assignedRegionId: 'assigned_region_id',
    lat: 'lat',
    lng: 'lng',
  }

  const selectedOptionalFields = optionalFields.filter((field) => availableColumns.has(columnMap[field]))
  if (!selectedOptionalFields.length) return fallbackAccount

  const fieldSql = sql.join(
    selectedOptionalFields.map((field) => sql`${sql.identifier(columnMap[field])}`),
    sql`, `
  )
  const optionalResult = await db.execute(sql`
    select ${fieldSql}
    from customer_accounts
    where id = ${accountId}::uuid
    limit 1
  `)

  const optionalRow = (optionalResult.rows[0] ?? {}) as Record<string, unknown>
  for (const field of selectedOptionalFields) {
    const columnName = columnMap[field]
    fallbackAccount[field] = (optionalRow[columnName] ?? fallbackAccount[field]) as never
  }

  return fallbackAccount
}
