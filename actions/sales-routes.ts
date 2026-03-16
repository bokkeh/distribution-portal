'use server'

import { and, asc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { salesRoutes, salesRouteStops, customerAccounts } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { geocodeAddress } from '@/lib/maps/geocode'

export async function createSalesRoute(formData: FormData) {
  await requireAdminOrStaff()

  const name = (formData.get('name') as string)?.trim()
  if (!name) throw new Error('Route name is required')

  const description = (formData.get('description') as string)?.trim() || null

  const [route] = await db
    .insert(salesRoutes)
    .values({ name, description })
    .returning({ id: salesRoutes.id })

  redirect(`/admin/crm/sales-routes/${route.id}`)
}

export async function deleteSalesRoute(routeId: string) {
  await requireAdminOrStaff()
  await db.delete(salesRoutes).where(eq(salesRoutes.id, routeId))
  redirect('/admin/crm/sales-routes')
}

export async function addSalesRouteStop(routeId: string, formData: FormData) {
  await requireAdminOrStaff()

  const customerId = formData.get('customerId') as string
  if (!customerId) throw new Error('Account is required')

  const [account] = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
      contactName: customerAccounts.contactName,
      pocPhone: customerAccounts.pocPhone,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, customerId))

  if (!account) throw new Error('Account not found')

  const addressParts = [account.address, account.city, account.state, account.zip].filter(Boolean)
  const address = addressParts.join(', ')
  if (!address) {
    redirect(`/admin/crm/sales-routes/${routeId}?error=Account+has+no+address+on+file`)
  }

  const existingStops = await db
    .select({ sequenceNumber: salesRouteStops.sequenceNumber })
    .from(salesRouteStops)
    .where(eq(salesRouteStops.routeId, routeId))

  const nextSeq =
    existingStops.length > 0 ? Math.max(...existingStops.map((s) => s.sequenceNumber)) + 1 : 1

  let lat: string | null = null
  let lng: string | null = null
  try {
    const geo = await geocodeAddress(address)
    if (geo) {
      lat = String(geo.lat)
      lng = String(geo.lng)
    }
  } catch {
    // geocoding failure is non-fatal
  }

  await db.insert(salesRouteStops).values({
    routeId,
    customerId,
    sequenceNumber: nextSeq,
    address,
    contactName: account.contactName ?? null,
    contactPhone: account.pocPhone ?? null,
    lat,
    lng,
  })

  redirect(`/admin/crm/sales-routes/${routeId}`)
}

export async function removeSalesRouteStop(routeId: string, stopId: string) {
  await requireAdminOrStaff()

  await db
    .delete(salesRouteStops)
    .where(and(eq(salesRouteStops.id, stopId), eq(salesRouteStops.routeId, routeId)))

  const remaining = await db
    .select({ id: salesRouteStops.id })
    .from(salesRouteStops)
    .where(eq(salesRouteStops.routeId, routeId))
    .orderBy(asc(salesRouteStops.sequenceNumber))

  for (let i = 0; i < remaining.length; i++) {
    await db
      .update(salesRouteStops)
      .set({ sequenceNumber: i + 1 })
      .where(eq(salesRouteStops.id, remaining[i].id))
  }

  return { success: true }
}

export async function reorderSalesRouteStops(routeId: string, orderedIds: string[]) {
  await requireAdminOrStaff()

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(salesRouteStops)
      .set({ sequenceNumber: i + 1 })
      .where(and(eq(salesRouteStops.id, orderedIds[i]), eq(salesRouteStops.routeId, routeId)))
  }

  return { success: true }
}
