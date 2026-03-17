'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { deliveries, deliveryStops, salesRoutes, salesRouteStops } from '@/db/schema'
import { geocodeAddress } from '@/lib/maps/geocode'

export async function updateSharedSalesRouteOrigin(routeId: string, formData: FormData) {
  const address = (formData.get('originAddress') as string)?.trim() || null

  if (!address) {
    await db
      .update(salesRoutes)
      .set({ originAddress: null, originLat: null, originLng: null })
      .where(eq(salesRoutes.id, routeId))

    revalidatePath(`/share/sales-route/${routeId}`)
    revalidatePath(`/admin/crm/sales-routes/${routeId}`)
    return { success: true }
  }

  let lat: string | null = null
  let lng: string | null = null
  try {
    const geo = await geocodeAddress(address)
    if (geo) {
      lat = String(geo.lat)
      lng = String(geo.lng)
    }
  } catch {
    // Non-fatal, address can still be saved for display and directions.
  }

  await db
    .update(salesRoutes)
    .set({ originAddress: address, originLat: lat, originLng: lng })
    .where(eq(salesRoutes.id, routeId))

  revalidatePath(`/share/sales-route/${routeId}`)
  revalidatePath(`/admin/crm/sales-routes/${routeId}`)
  return { success: true }
}

export async function updateSharedSalesRouteStopNotes(routeId: string, stopId: string, formData: FormData) {
  const notes = (formData.get('notes') as string)?.trim() || null

  await db
    .update(salesRouteStops)
    .set({ notes })
    .where(and(eq(salesRouteStops.id, stopId), eq(salesRouteStops.routeId, routeId)))

  revalidatePath(`/share/sales-route/${routeId}`)
  revalidatePath(`/admin/crm/sales-routes/${routeId}`)
  return { success: true }
}

export async function updateSharedDeliveryOrigin(deliveryId: string, formData: FormData) {
  const address = (formData.get('originAddress') as string)?.trim() || null

  if (!address) {
    await db
      .update(deliveries)
      .set({ originAddress: null, originLat: null, originLng: null })
      .where(eq(deliveries.id, deliveryId))

    revalidatePath(`/share/delivery/${deliveryId}`)
    revalidatePath(`/admin/deliveries/${deliveryId}`)
    return { success: true }
  }

  let lat: string | null = null
  let lng: string | null = null
  try {
    const geo = await geocodeAddress(address)
    if (geo) {
      lat = String(geo.lat)
      lng = String(geo.lng)
    }
  } catch {
    // Non-fatal, address can still be saved for display and directions.
  }

  await db
    .update(deliveries)
    .set({ originAddress: address, originLat: lat, originLng: lng })
    .where(eq(deliveries.id, deliveryId))

  revalidatePath(`/share/delivery/${deliveryId}`)
  revalidatePath(`/admin/deliveries/${deliveryId}`)
  return { success: true }
}

export async function updateSharedDeliveryStopNotes(deliveryId: string, stopId: string, formData: FormData) {
  const notes = (formData.get('notes') as string)?.trim() || null

  await db
    .update(deliveryStops)
    .set({ notes })
    .where(and(eq(deliveryStops.id, stopId), eq(deliveryStops.deliveryId, deliveryId)))

  revalidatePath(`/share/delivery/${deliveryId}`)
  revalidatePath(`/admin/deliveries/${deliveryId}`)
  return { success: true }
}
