'use server'

import { eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, invoices, salesMembers, salesRegions, tastings } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'

export type RepMapAccount = {
  id: string
  companyName: string
  address: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  businessType: string | null
  accountType: string | null
  lastVisitDate: Date | null
  nextRequiredVisitDate: Date | null
  visitFrequency: number | null
  assignedSalesRepId: string | null
  revenue: number
  tastingCount: number
}

export type RepMapData = {
  regionName: string | null
  accounts: RepMapAccount[]
}

export async function getSalesRepRegionMapData(): Promise<RepMapData> {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')

  const [member] = await db
    .select()
    .from(salesMembers)
    .where(eq(salesMembers.userId, session.user.id))
    .limit(1)

  if (!member) return { regionName: null, accounts: [] }

  // Find this rep's assigned region
  const [region] = await db
    .select({ id: salesRegions.id, name: salesRegions.name })
    .from(salesRegions)
    .where(eq(salesRegions.assignedManagerId, member.id))
    .limit(1)

  // Get accounts — either in their region or directly assigned to them
  const rawAccounts = region
    ? await db
        .select({
          id: customerAccounts.id,
          companyName: customerAccounts.companyName,
          address: customerAccounts.address,
          city: customerAccounts.city,
          state: customerAccounts.state,
          lat: customerAccounts.lat,
          lng: customerAccounts.lng,
          phone: customerAccounts.phone,
          businessType: customerAccounts.businessType,
          accountType: customerAccounts.accountType,
          lastVisitDate: customerAccounts.lastVisitDate,
          nextRequiredVisitDate: customerAccounts.nextRequiredVisitDate,
          visitFrequency: customerAccounts.visitFrequency,
          assignedSalesRepId: customerAccounts.assignedSalesRepId,
        })
        .from(customerAccounts)
        .where(eq(customerAccounts.assignedRegionId, region.id))
    : await db
        .select({
          id: customerAccounts.id,
          companyName: customerAccounts.companyName,
          address: customerAccounts.address,
          city: customerAccounts.city,
          state: customerAccounts.state,
          lat: customerAccounts.lat,
          lng: customerAccounts.lng,
          phone: customerAccounts.phone,
          businessType: customerAccounts.businessType,
          accountType: customerAccounts.accountType,
          lastVisitDate: customerAccounts.lastVisitDate,
          nextRequiredVisitDate: customerAccounts.nextRequiredVisitDate,
          visitFrequency: customerAccounts.visitFrequency,
          assignedSalesRepId: customerAccounts.assignedSalesRepId,
        })
        .from(customerAccounts)
        .where(eq(customerAccounts.assignedSalesRepId, member.id))

  if (rawAccounts.length === 0) return { regionName: region?.name ?? null, accounts: [] }

  const accountIds = rawAccounts.map(a => a.id)

  const revenueRows = await db
    .select({
      customerId: invoices.customerId,
      revenue: sql<number>`coalesce(sum(${invoices.total}::numeric), 0)::float`.as('revenue'),
    })
    .from(invoices)
    .where(eq(invoices.status, 'paid'))
    .groupBy(invoices.customerId)

  const tastingRows = await db
    .select({
      customerId: tastings.customerId,
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(tastings)
    .where(inArray(tastings.customerId, accountIds))
    .groupBy(tastings.customerId)

  const revenueMap = new Map(revenueRows.map(r => [r.customerId, r.revenue]))
  const tastingMap = new Map(tastingRows.map(r => [r.customerId, r.count]))

  const accounts: RepMapAccount[] = rawAccounts.map(a => ({
    ...a,
    revenue: revenueMap.get(a.id) ?? 0,
    tastingCount: tastingMap.get(a.id) ?? 0,
  }))

  return { regionName: region?.name ?? null, accounts }
}
