import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts } from '@/db/schema'

export type CRMAccountDetail = {
  id: string
  userId: string | null
  assignedSalesRepId: string | null
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
  website: string | null
  creditLimit: string
  balance: string
  paymentTerms: string | null
  customerSegment: string | null
  customerSource: string | null
  sourceExternalId: string | null
  assignedRegionId: string | null
  lat: number | null
  lng: number | null
  createdAt: Date
}


export async function getCRMAccountDetail(accountId: string): Promise<CRMAccountDetail | null> {
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
  return account ?? null
}
