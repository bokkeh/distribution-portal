'use server'

import { and, eq, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, deliveryStops, orders, salesMembers, salesRegions, tastings, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { geocodeAddress } from '@/lib/maps/geocode'
import { isBatchGeocodeRateLimited } from '@/lib/auth/rate-limit'

export type RegionMapAccount = {
  id: string
  companyName: string
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  lat: number | null
  lng: number | null
  regionId: string | null
  assignedSalesRepId: string | null
  businessType: string | null
  accountType: string | null
  accountPriority: string | null
  phone: string | null
  lastVisitDate: Date | null
  nextRequiredVisitDate: Date | null
  visitFrequency: number | null
  revenue: number
  tastingCount: number
  deliveryCount: number
}

export type RegionMapRegion = {
  id: string
  name: string
  description: string | null
  assignedManagerId: string | null  // salesMembers.id — used for rep assignment
  assignedRep: { id: string; name: string; email: string } | null
  stats: {
    accountCount: number
    totalRevenue: number
    tastingCount: number
    deliveryCount: number
  }
}

export type RegionMapData = {
  regions: RegionMapRegion[]
  accounts: RegionMapAccount[]
}

export async function getRegionMapData(): Promise<RegionMapData> {
  await requireAdmin()

  // Regions with assigned rep info
  const rawRegions = await db
    .select({
      id: salesRegions.id,
      name: salesRegions.name,
      description: salesRegions.description,
      assignedManagerId: salesMembers.id,
      repUserId: users.id,
      repName: users.name,
      repEmail: users.email,
    })
    .from(salesRegions)
    .leftJoin(salesMembers, eq(salesRegions.assignedManagerId, salesMembers.id))
    .leftJoin(users, eq(salesMembers.userId, users.id))
    .orderBy(salesRegions.name)

  // All accounts (minimal fields for map)
  const rawAccounts = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
      lat: customerAccounts.lat,
      lng: customerAccounts.lng,
      regionId: customerAccounts.assignedRegionId,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
      businessType: customerAccounts.businessType,
      accountType: customerAccounts.accountType,
      accountPriority: customerAccounts.accountPriority,
      phone: customerAccounts.phone,
      lastVisitDate: customerAccounts.lastVisitDate,
      nextRequiredVisitDate: customerAccounts.nextRequiredVisitDate,
      visitFrequency: customerAccounts.visitFrequency,
    })
    .from(customerAccounts)

  // Revenue per account should match the rest of the portal:
  // sum posted order totals, excluding cancelled orders.
  const revenueRows = await db
    .select({
      customerId: orders.customerId,
      revenue: sql<number>`coalesce(sum(${orders.total}::numeric), 0)::float`.as('revenue'),
    })
    .from(orders)
    .where(and(
      isNotNull(orders.customerId),
      ne(orders.status, 'cancelled'),
    ))
    .groupBy(orders.customerId)

  // Tasting count per account
  const tastingRows = await db
    .select({
      customerId: tastings.customerId,
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(tastings)
    .groupBy(tastings.customerId)

  // Delivery stop count per account
  const deliveryRows = await db
    .select({
      customerId: deliveryStops.customerId,
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(deliveryStops)
    .where(isNotNull(deliveryStops.customerId))
    .groupBy(deliveryStops.customerId)

  // Build lookup maps
  const revenueByAccount = new Map(revenueRows.map(r => [r.customerId, r.revenue]))
  const tastingsByAccount = new Map(tastingRows.map(r => [r.customerId, r.count]))
  const deliveriesByAccount = new Map(deliveryRows.map(r => [r.customerId, r.count]))

  // Enrich accounts
  const accounts: RegionMapAccount[] = rawAccounts.map(a => ({
    ...a,
    revenue: revenueByAccount.get(a.id) ?? 0,
    tastingCount: tastingsByAccount.get(a.id) ?? 0,
    deliveryCount: deliveriesByAccount.get(a.id) ?? 0,
  }))

  // Compute per-region stats from accounts
  const statsByRegion = new Map<string, { accountCount: number; totalRevenue: number; tastingCount: number; deliveryCount: number }>()
  for (const a of accounts) {
    if (!a.regionId) continue
    const existing = statsByRegion.get(a.regionId) ?? { accountCount: 0, totalRevenue: 0, tastingCount: 0, deliveryCount: 0 }
    statsByRegion.set(a.regionId, {
      accountCount: existing.accountCount + 1,
      totalRevenue: existing.totalRevenue + a.revenue,
      tastingCount: existing.tastingCount + a.tastingCount,
      deliveryCount: existing.deliveryCount + a.deliveryCount,
    })
  }

  const regions: RegionMapRegion[] = rawRegions.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    assignedManagerId: r.assignedManagerId ?? null,
    assignedRep: r.repUserId
      ? { id: r.repUserId, name: r.repName!, email: r.repEmail! }
      : null,
    stats: statsByRegion.get(r.id) ?? { accountCount: 0, totalRevenue: 0, tastingCount: 0, deliveryCount: 0 },
  }))

  return { regions, accounts }
}

export async function geocodeAccountsBatch(): Promise<{ geocoded: number; failed: number; error?: string }> {
  const session = await requireAdmin()
  if (await isBatchGeocodeRateLimited(session.user.id)) {
    return { geocoded: 0, failed: 0, error: 'Batch geocode limit reached. Please wait before running another batch.' }
  }

  const toGeocode = await db
    .select({
      id: customerAccounts.id,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
    })
    .from(customerAccounts)
    .where(
      isNull(customerAccounts.lat),
    )

  const withAddress = toGeocode.filter(a => a.address || a.city)

  let geocoded = 0
  let failed = 0

  for (const account of withAddress) {
    const parts = [account.address, account.city, account.state, account.zip].filter(Boolean)
    const fullAddress = parts.join(', ')

    const coords = await geocodeAddress(fullAddress, { forceRefresh: true })

    if (coords) {
      await db
        .update(customerAccounts)
        .set({ lat: coords.lat, lng: coords.lng })
        .where(eq(customerAccounts.id, account.id))
      geocoded++
    } else {
      failed++
    }

    // Respect rate limits
    await new Promise(r => setTimeout(r, 100))
  }

  return { geocoded, failed }
}
