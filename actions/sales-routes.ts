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

export async function duplicateSalesRoute(sourceRouteId: string, formData: FormData) {
  await requireAdminOrStaff()

  const name = (formData.get('name') as string)?.trim()
  if (!name) throw new Error('Route name is required')

  // Get the source route
  const [source] = await db
    .select()
    .from(salesRoutes)
    .where(eq(salesRoutes.id, sourceRouteId))
  if (!source) throw new Error('Route not found')

  // Create the new route
  const [newRoute] = await db
    .insert(salesRoutes)
    .values({ name, description: source.description })
    .returning({ id: salesRoutes.id })

  // Copy all stops
  const stops = await db
    .select()
    .from(salesRouteStops)
    .where(eq(salesRouteStops.routeId, sourceRouteId))
    .orderBy(asc(salesRouteStops.sequenceNumber))

  if (stops.length > 0) {
    await db.insert(salesRouteStops).values(
      stops.map((stop) => ({
        routeId: newRoute.id,
        customerId: stop.customerId,
        sequenceNumber: stop.sequenceNumber,
        address: stop.address,
        contactName: stop.contactName,
        contactPhone: stop.contactPhone,
        lat: stop.lat,
        lng: stop.lng,
        notes: stop.notes,
      }))
    )
  }

  redirect(`/admin/crm/sales-routes/${newRoute.id}`)
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

export async function addManualSalesRouteStop(routeId: string, formData: FormData) {
  await requireAdminOrStaff()

  const address = (formData.get('address') as string)?.trim()
  if (!address) {
    redirect(`/admin/crm/sales-routes/${routeId}?addStop=1&error=Address+is+required`)
  }

  const contactName = (formData.get('contactName') as string)?.trim() || null
  const contactPhone = (formData.get('contactPhone') as string)?.trim() || null

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
    // non-fatal
  }

  await db.insert(salesRouteStops).values({
    routeId,
    customerId: null,
    sequenceNumber: nextSeq,
    address,
    contactName,
    contactPhone,
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

export async function optimizeSalesRouteOrder(
  routeId: string,
  stops: Array<{ id: string; lat: number; lng: number }>
): Promise<{ orderedIds: string[] }> {
  await requireAdminOrStaff()

  const geocoded = stops.filter((s) => s.lat !== 0 && s.lng !== 0)
  const ungeocodable = stops.filter((s) => s.lat === 0 && s.lng === 0)

  // Need at least 2 geocoded stops to optimize
  if (geocoded.length < 2) return { orderedIds: stops.map((s) => s.id) }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  let optimizedGeocoded = geocoded

  if (apiKey && geocoded.length >= 2) {
    try {
      const origin = `${geocoded[0].lat},${geocoded[0].lng}`
      const destination = `${geocoded[geocoded.length - 1].lat},${geocoded[geocoded.length - 1].lng}`
      const middle = geocoded.slice(1, -1)

      const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
      url.searchParams.set('origin', origin)
      url.searchParams.set('destination', destination)
      if (middle.length > 0) {
        url.searchParams.set(
          'waypoints',
          `optimize:true|${middle.map((s) => `${s.lat},${s.lng}`).join('|')}`
        )
      }
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString())
      const data = await res.json()

      if (data.status === 'OK' && data.routes?.[0]) {
        const waypointOrder: number[] = data.routes[0].waypoint_order ?? []
        optimizedGeocoded = [
          geocoded[0],
          ...waypointOrder.map((i) => middle[i]),
          geocoded[geocoded.length - 1],
        ]
      }
    } catch {
      // Fallback to nearest-neighbor below
    }
  }

  // Fallback nearest-neighbor if API unavailable
  if (optimizedGeocoded === geocoded && apiKey) {
    // API returned same — already optimal, use as-is
  } else if (!apiKey) {
    // No API key: use nearest-neighbor
    const visited = new Set<string>([geocoded[0].id])
    const result = [geocoded[0]]
    while (result.length < geocoded.length) {
      const cur = result[result.length - 1]
      let nearest = geocoded.find((s) => !visited.has(s.id))!
      let nearestDist = Infinity
      for (const s of geocoded) {
        if (visited.has(s.id)) continue
        const dLat = ((s.lat - cur.lat) * Math.PI) / 180
        const dLng = ((s.lng - cur.lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((cur.lat * Math.PI) / 180) *
            Math.cos((s.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
        const d = 2 * 6371 * Math.asin(Math.sqrt(a))
        if (d < nearestDist) {
          nearestDist = d
          nearest = s
        }
      }
      result.push(nearest)
      visited.add(nearest.id)
    }
    optimizedGeocoded = result
  }

  const orderedIds = [
    ...optimizedGeocoded.map((s) => s.id),
    ...ungeocodable.map((s) => s.id),
  ]

  // Persist
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(salesRouteStops)
      .set({ sequenceNumber: i + 1 })
      .where(and(eq(salesRouteStops.id, orderedIds[i]), eq(salesRouteStops.routeId, routeId)))
  }

  return { orderedIds }
}
