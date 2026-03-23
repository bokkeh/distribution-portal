'use server'

import { db } from '@/db'
import { deliveries, deliveryStops, orders, drivers, users, customerAccounts } from '@/db/schema'
import { requireAdmin, requireAdminOrStaff, requireRole } from '@/lib/auth/session'
import { and, count, desc, eq, inArray, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { geocodeAddress } from '@/lib/maps/geocode'
import { generateSignedUploadUrl } from '@/lib/gcs/client'
import { notify } from '@/lib/notifications/dispatch'
import { v4 as uuidv4 } from 'uuid'
import { logActivityEvent } from '@/lib/activity/log'
import { getAccountPreferences, getUserPreferences } from '@/lib/preferences/read'
import { formatDateInTimeZone, getShortTimeZoneLabel } from '@/lib/timezones'
import { logAccountNoteEvent } from '@/lib/crm/account-notes'

async function resequenceDeliveryStops(deliveryId: string) {
  const existingStops = await db
    .select({
      id: deliveryStops.id,
      sequenceNumber: deliveryStops.sequenceNumber,
    })
    .from(deliveryStops)
    .where(eq(deliveryStops.deliveryId, deliveryId))
    .orderBy(deliveryStops.sequenceNumber)

  for (let index = 0; index < existingStops.length; index++) {
    const stop = existingStops[index]
    const nextSequenceNumber = index + 1

    if (stop.sequenceNumber === nextSequenceNumber) continue

    await db.update(deliveryStops)
      .set({ sequenceNumber: nextSequenceNumber })
      .where(eq(deliveryStops.id, stop.id))
  }
}

async function requireDeliveryReorderAccess(deliveryId: string) {
  const session = await requireRole('driver', 'admin')
  const userRoles = session.user.roles ?? [session.user.role as string]

  if (userRoles.includes('admin')) {
    return
  }

  const [driver] = await db
    .select({
      id: drivers.id,
    })
    .from(drivers)
    .where(eq(drivers.userId, session.user.id))
    .limit(1)

  if (!driver) {
    throw new Error('Driver profile not found')
  }

  const [delivery] = await db
    .select({
      id: deliveries.id,
    })
    .from(deliveries)
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.driverId, driver.id)))
    .limit(1)

  if (!delivery) {
    throw new Error('Unauthorized')
  }
}


export async function createDelivery(formData: FormData) {
  await requireAdmin()

  const weekStartDate = formData.get('weekStartDate') as string
  const driverId = formData.get('driverId') as string
  const orderIds = formData.getAll('orderIds') as string[]

  const [delivery] = await db.insert(deliveries).values({
    weekStartDate,
    driverId,
    status: 'scheduled',
  }).returning()

  if (orderIds.length > 0) {
    const selectedOrders = await db
      .select({
        id: orders.id,
        customerId: orders.customerId,
        companyName: customerAccounts.companyName,
        address: customerAccounts.address,
        city: customerAccounts.city,
        state: customerAccounts.state,
        zip: customerAccounts.zip,
        contactName: customerAccounts.contactName,
        pocName: customerAccounts.pocName,
        pocPhone: customerAccounts.pocPhone,
        pocEmail: customerAccounts.pocEmail,
      })
      .from(orders)
      .leftJoin(customerAccounts, eq(orders.customerId, customerAccounts.id))
      .where(inArray(orders.id, orderIds))

    for (let i = 0; i < selectedOrders.length; i++) {
      const order = selectedOrders[i]
      const fullAddress = [order.address, order.city, order.state, order.zip].filter(Boolean).join(', ') || 'Address not provided'
      const contactName = order.pocName || order.contactName || order.companyName || null
      let lat: number | null = null
      let lng: number | null = null

      try {
        const coords = await geocodeAddress(fullAddress)
        lat = coords?.lat ?? null
        lng = coords?.lng ?? null
      } catch {}

      await db.insert(deliveryStops).values({
        deliveryId: delivery.id,
        orderId: order.id,
        customerId: order.customerId,
        sequenceNumber: i + 1,
        address: fullAddress,
        contactName,
        contactPhone: order.pocPhone ?? null,
        contactEmail: order.pocEmail ?? null,
        lat: lat?.toFixed(7) ?? null,
        lng: lng?.toFixed(7) ?? null,
        status: 'pending',
      })
    }
  }

  await logActivityEvent({
    entityType: 'delivery',
    entityId: delivery.id,
    actorUserId: null,
    kind: 'delivery_created',
    title: 'Delivery scheduled',
    body: `${orderIds.length} stop(s) scheduled for ${weekStartDate}.`,
  })

  const [driver] = await db
    .select({ phone: drivers.phone, name: users.name, email: users.email, userId: users.id })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))

  const driverPrefs = driver ? await getUserPreferences(driver.userId).catch(() => null) : null

  await notify('delivery.driver_assigned', {
    driverName: driver?.name ?? 'Driver',
    driverEmail: (driverPrefs?.emailNotificationsEnabled ?? true) ? (driver?.email ?? '') : '',
    driverPhone: (driverPrefs?.smsNotificationsEnabled ?? true) ? (driver?.phone ?? null) : null,
    weekStartDate,
    stopCount: orderIds.length,
    userId: driver?.userId ?? null,
  })

  revalidatePath('/admin/deliveries')
  redirect(`/admin/deliveries/${delivery.id}`)
}

export async function updateStopStatus(stopId: string, status: 'delivered' | 'failed') {
  await requireAdminOrStaff()

  const [stop] = await db
    .select({ id: deliveryStops.id, deliveryId: deliveryStops.deliveryId, orderId: deliveryStops.orderId })
    .from(deliveryStops)
    .where(eq(deliveryStops.id, stopId))
    .limit(1)

  await db.update(deliveryStops)
    .set({ status, completedAt: status === 'delivered' ? new Date() : null })
    .where(eq(deliveryStops.id, stopId))

  if (stop?.orderId && status === 'delivered') {
    await db.update(orders)
      .set({ shippingStatus: 'delivered' })
      .where(eq(orders.id, stop.orderId))
  }

  if (stop) {
    const [{ pendingCount }] = await db
      .select({ pendingCount: count() })
      .from(deliveryStops)
      .where(and(
        eq(deliveryStops.deliveryId, stop.deliveryId),
        ne(deliveryStops.id, stop.id),
        eq(deliveryStops.status, 'pending'),
      ))

    if (pendingCount === 0) {
      await db.update(deliveries)
        .set({ status: 'completed' })
        .where(eq(deliveries.id, stop.deliveryId))

      await notify('delivery.run_completed', {
        deliveryId: stop.deliveryId,
        deliveryUrl: `${process.env.NEXTAUTH_URL}/admin/deliveries/${stop.deliveryId}`,
      })
    }
  }

  revalidatePath('/driver/deliveries')
  revalidatePath('/admin/deliveries')
}

export async function getDeliveryStopUploadUrl(
  kind: 'proof' | 'shelf',
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string; error?: string }> {
  try {
    await requireRole('driver', 'admin')
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const filename = `${kind}-${uuidv4()}.${ext}`
    return await generateSignedUploadUrl(filename, contentType, 'deliveries')
  } catch (error) {
    return { uploadUrl: '', publicUrl: '', error: error instanceof Error ? error.message : String(error) }
  }
}

export async function completeDeliveryStop(stopId: string, formData: FormData) {
  await requireRole('driver', 'admin')

  const proofOfDeliveryUrl = ((formData.get('proofOfDeliveryUrl') as string) || '').trim() || null
  const shelfPhotoUrl = ((formData.get('shelfPhotoUrl') as string) || '').trim() || null
  const additionalPhotoUrls = Array.from({ length: 5 }, (_, index) => (
    ((formData.get(`additionalPhotoUrl${index + 1}`) as string) || '').trim() || null
  ))
  const notes = ((formData.get('notes') as string) || '').trim() || null

  const [stop] = await db
    .select({
      id: deliveryStops.id,
      deliveryId: deliveryStops.deliveryId,
      orderId: deliveryStops.orderId,
      customerId: deliveryStops.customerId,
      address: deliveryStops.address,
      companyName: customerAccounts.companyName,
      contactPhone: deliveryStops.contactPhone,
      contactEmail: deliveryStops.contactEmail,
      accountPhone: customerAccounts.phone,
      accountEmail: customerAccounts.email,
      businessEmail: customerAccounts.businessEmail,
      notificationPreference: customerAccounts.notificationPreference,
    })
    .from(deliveryStops)
    .leftJoin(customerAccounts, eq(deliveryStops.customerId, customerAccounts.id))
    .where(eq(deliveryStops.id, stopId))
    .limit(1)

  if (!stop) {
    throw new Error('Stop not found')
  }

  await db.update(deliveryStops)
    .set({
      status: 'delivered',
      completedAt: new Date(),
      notes,
      proofOfDeliveryUrl,
      shelfPhotoUrl,
      additionalPhotoUrl: additionalPhotoUrls[0],
      additionalPhotoUrl2: additionalPhotoUrls[1],
      additionalPhotoUrl3: additionalPhotoUrls[2],
      additionalPhotoUrl4: additionalPhotoUrls[3],
      additionalPhotoUrl5: additionalPhotoUrls[4],
    })
    .where(eq(deliveryStops.id, stopId))

  // Update linked order shipping status to 'delivered'
  if (stop.orderId) {
    await db.update(orders)
      .set({ shippingStatus: 'delivered' })
      .where(eq(orders.id, stop.orderId))
  }

  // Check if all stops on this delivery are now completed (none still pending)
  const [{ pendingCount }] = await db
    .select({ pendingCount: count() })
    .from(deliveryStops)
    .where(and(
      eq(deliveryStops.deliveryId, stop.deliveryId),
      ne(deliveryStops.id, stop.id),           // exclude the stop we just updated
      eq(deliveryStops.status, 'pending'),
    ))

  if (pendingCount === 0) {
    // All stops done — mark the whole delivery completed
    await db.update(deliveries)
      .set({ status: 'completed' })
      .where(eq(deliveries.id, stop.deliveryId))

    await notify('delivery.run_completed', {
      deliveryId: stop.deliveryId,
      deliveryUrl: `${process.env.NEXTAUTH_URL}/admin/deliveries/${stop.deliveryId}`,
    })
  }

  const notificationPhone = stop.contactPhone || stop.accountPhone
  const notificationEmail = stop.contactEmail || stop.businessEmail || stop.accountEmail
  const accountPrefs = stop.customerId ? await getAccountPreferences(stop.customerId, null).catch(() => null) : null
  const deliveryTimeZone = accountPrefs?.timeZone ?? 'America/New_York'
  const deliveryDate = formatDateInTimeZone(new Date(), deliveryTimeZone)
  const prefersNoSms = stop.notificationPreference === 'email'
  const prefersEmail = !stop.notificationPreference || stop.notificationPreference === 'email' || stop.notificationPreference === 'both'

  await notify('delivery.completed', {
    companyName: stop.companyName ?? stop.address,
    deliveryDate,
    deliveryId: stop.deliveryId,
    customerEmail: notificationEmail && prefersEmail ? notificationEmail : null,
    customerPhone: notificationPhone && !prefersNoSms ? notificationPhone : null,
    proofOfDeliveryUrl,
    shelfPhotoUrl,
  })

  await logActivityEvent({
    entityType: 'delivery',
    entityId: stop.deliveryId,
    kind: 'delivery_stop_completed',
    title: 'Stop marked delivered',
    body: `${stop.companyName ?? stop.address} was completed.`,
  })

  await logAccountNoteEvent({
    accountId: stop.customerId,
    title: 'Delivery stop note added',
    note: notes,
    source: 'delivery_stop',
    sourceId: stop.id,
  })

  revalidatePath('/driver/deliveries')
  revalidatePath('/driver/map')
}

export async function updateStopNotes(stopId: string, formData: FormData) {
  const session = await requireRole('driver', 'admin')

  const notes = ((formData.get('notes') as string) || '').trim()

  await db.update(deliveryStops)
    .set({ notes: notes || null })
    .where(eq(deliveryStops.id, stopId))

  const [stop] = await db
    .select({ deliveryId: deliveryStops.deliveryId, address: deliveryStops.address, customerId: deliveryStops.customerId })
    .from(deliveryStops)
    .where(eq(deliveryStops.id, stopId))
    .limit(1)

  if (stop) {
    await logActivityEvent({
      entityType: 'delivery',
      entityId: stop.deliveryId,
      actorUserId: session.user.id,
      kind: 'delivery_notes_updated',
      title: 'Delivery notes updated',
      body: `Notes were updated for ${stop.address}.`,
    })

    await logAccountNoteEvent({
      accountId: stop.customerId,
      actorUserId: session.user.id,
      title: 'Delivery stop note updated',
      note: notes,
      source: 'delivery_stop',
      sourceId: stopId,
    })
  }

  revalidatePath('/driver/deliveries')
  revalidatePath('/driver/map')
}

export async function updateDeliveryStop(
  deliveryId: string,
  stopId: string,
  data: { address: string; contactName: string | null; contactPhone: string | null; notes: string | null }
) {
  await requireAdmin()

  let lat: number | null = null
  let lng: number | null = null
  try {
    const coords = await geocodeAddress(data.address)
    lat = coords?.lat ?? null
    lng = coords?.lng ?? null
  } catch { /* non-fatal */ }

  await db
    .update(deliveryStops)
    .set({
      address: data.address,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      notes: data.notes,
      lat: lat?.toFixed(7) ?? null,
      lng: lng?.toFixed(7) ?? null,
    })
    .where(and(eq(deliveryStops.id, stopId), eq(deliveryStops.deliveryId, deliveryId)))

  const [stop] = await db
    .select({ customerId: deliveryStops.customerId })
    .from(deliveryStops)
    .where(and(eq(deliveryStops.id, stopId), eq(deliveryStops.deliveryId, deliveryId)))
    .limit(1)

  await logAccountNoteEvent({
    accountId: stop?.customerId,
    title: 'Delivery stop note updated',
    note: data.notes,
    source: 'delivery_stop',
    sourceId: stopId,
  })

  revalidatePath(`/admin/deliveries/${deliveryId}`)
  revalidatePath('/driver/deliveries')
  revalidatePath('/driver/map')
  return { success: true }
}

export async function removeDeliveryStop(deliveryId: string, stopId: string) {
  await requireAdmin()

  const [stop] = await db
    .select({ address: deliveryStops.address })
    .from(deliveryStops)
    .where(eq(deliveryStops.id, stopId))
    .limit(1)

  await db.delete(deliveryStops).where(eq(deliveryStops.id, stopId))
  await resequenceDeliveryStops(deliveryId)

  await logActivityEvent({
    entityType: 'delivery',
    entityId: deliveryId,
    kind: 'delivery_stop_removed',
    title: 'Stop removed',
    body: stop ? `${stop.address} was removed from the route.` : 'A stop was removed from the route.',
  })

  revalidatePath(`/admin/deliveries/${deliveryId}`)
  revalidatePath('/admin/deliveries')
  revalidatePath('/driver/deliveries')
  revalidatePath('/driver/map')
}

export async function reorderDeliveryStops(deliveryId: string, stopIds: string[]) {
  await requireDeliveryReorderAccess(deliveryId)

  if (stopIds.length === 0) return

  const existingStops = await db
    .select({
      id: deliveryStops.id,
    })
    .from(deliveryStops)
    .where(eq(deliveryStops.deliveryId, deliveryId))
    .orderBy(deliveryStops.sequenceNumber)

  if (existingStops.length !== stopIds.length) {
    throw new Error('Stop list is out of sync')
  }

  const existingStopIds = new Set(existingStops.map(stop => stop.id))
  if (stopIds.some(id => !existingStopIds.has(id))) {
    throw new Error('One or more stops do not belong to this delivery')
  }

  for (let index = 0; index < stopIds.length; index++) {
    await db.update(deliveryStops)
      .set({ sequenceNumber: index + 1 })
      .where(and(eq(deliveryStops.id, stopIds[index]), eq(deliveryStops.deliveryId, deliveryId)))
  }

  await logActivityEvent({
    entityType: 'delivery',
    entityId: deliveryId,
    kind: 'delivery_reordered',
    title: 'Stop order changed',
    body: `${stopIds.length} stops were reordered.`,
  })

  revalidatePath(`/admin/deliveries/${deliveryId}`)
  revalidatePath('/admin/deliveries')
  revalidatePath('/driver/deliveries')
  revalidatePath('/driver/map')
}

export async function reassignDeliveryDriver(deliveryId: string, formData: FormData) {
  await requireAdmin()

  const driverId = formData.get('driverId') as string
  if (!driverId) {
    redirect(`/admin/deliveries/${deliveryId}?error=${encodeURIComponent('Select a driver to reassign this delivery.')}`)
  }

  const [delivery] = await db
    .select({
      id: deliveries.id,
      weekStartDate: deliveries.weekStartDate,
    })
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
    .limit(1)

  if (!delivery) {
    redirect(`/admin/deliveries/${deliveryId}?error=${encodeURIComponent('Delivery not found.')}`)
  }

  await db.update(deliveries)
    .set({ driverId })
    .where(eq(deliveries.id, deliveryId))

  const [driver] = await db
    .select({ phone: drivers.phone, name: users.name, email: users.email, userId: users.id })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1)

  const stopRows = await db
    .select({ id: deliveryStops.id })
    .from(deliveryStops)
    .where(eq(deliveryStops.deliveryId, deliveryId))

  const driverPrefs = driver ? await getUserPreferences(driver.userId).catch(() => null) : null

  await logActivityEvent({
    entityType: 'delivery',
    entityId: deliveryId,
    kind: 'delivery_reassigned',
    title: 'Driver reassigned',
    body: driver ? `Delivery reassigned to ${driver.name}.` : 'Delivery driver was reassigned.',
  })

  await notify('delivery.driver_assigned', {
    driverName: driver?.name ?? 'Driver',
    driverEmail: (driverPrefs?.emailNotificationsEnabled ?? true) ? (driver?.email ?? '') : '',
    driverPhone: (driverPrefs?.smsNotificationsEnabled ?? true) ? (driver?.phone ?? null) : null,
    weekStartDate: delivery.weekStartDate,
    stopCount: stopRows.length,
    userId: driver?.userId ?? null,
  })

  revalidatePath(`/admin/deliveries/${deliveryId}`)
  revalidatePath('/admin/deliveries')
  revalidatePath('/driver/deliveries')
  revalidatePath('/driver/map')
  redirect(`/admin/deliveries/${deliveryId}`)
}

export async function addDeliveryStop(deliveryId: string, formData: FormData) {
  let errorMessage: string | null = null

  try {
    await requireAdmin()

    const customerId = formData.get('customerId') as string
    if (!customerId) {
      throw new Error('Select an account before adding a stop.')
    }

    const [delivery] = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))
      .limit(1)

    if (!delivery) {
      throw new Error('Delivery not found.')
    }

    const [account] = await db
      .select({
        id: customerAccounts.id,
        companyName: customerAccounts.companyName,
        address: customerAccounts.address,
        city: customerAccounts.city,
        state: customerAccounts.state,
        zip: customerAccounts.zip,
        contactName: customerAccounts.contactName,
        pocName: customerAccounts.pocName,
        pocPhone: customerAccounts.pocPhone,
        pocEmail: customerAccounts.pocEmail,
      })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, customerId))
      .limit(1)

    if (!account) {
      throw new Error('Customer account not found.')
    }

    const [latestStop] = await db
      .select({ sequenceNumber: deliveryStops.sequenceNumber })
      .from(deliveryStops)
      .where(eq(deliveryStops.deliveryId, deliveryId))
      .orderBy(desc(deliveryStops.sequenceNumber))
      .limit(1)

    const [openOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.customerId, customerId), inArray(orders.status, ['pending', 'confirmed'])))
      .limit(1)

    const fullAddress = [account.address, account.city, account.state, account.zip].filter(Boolean).join(', ')
    if (!fullAddress) {
      throw new Error('Selected account does not have a delivery address.')
    }

    const contactName = account.pocName || account.contactName || account.companyName || null

    let lat: number | null = null
    let lng: number | null = null

    try {
      const coords = await geocodeAddress(fullAddress)
      lat = coords?.lat ?? null
      lng = coords?.lng ?? null
    } catch {}

    await db.insert(deliveryStops).values({
      deliveryId,
      orderId: openOrder?.id ?? null,
      customerId: account.id,
      sequenceNumber: (latestStop?.sequenceNumber ?? 0) + 1,
      address: fullAddress,
      contactName,
      contactPhone: account.pocPhone ?? null,
      contactEmail: account.pocEmail ?? null,
      lat: lat?.toFixed(7) ?? null,
      lng: lng?.toFixed(7) ?? null,
      status: 'pending',
    })

    await logActivityEvent({
      entityType: 'delivery',
      entityId: deliveryId,
      kind: 'delivery_stop_added',
      title: 'Stop added',
      body: `${account.companyName} was added to the route.`,
    })

    revalidatePath(`/admin/deliveries/${deliveryId}`)
    revalidatePath('/driver/deliveries')
    revalidatePath('/driver/map')
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unable to add stop.'
  }

  if (errorMessage) {
    redirect(`/admin/deliveries/${deliveryId}?addStop=1&error=${encodeURIComponent(errorMessage)}`)
  }

  redirect(`/admin/deliveries/${deliveryId}`)
}

export async function addManualDeliveryStop(deliveryId: string, formData: FormData) {
  let errorMessage: string | null = null

  try {
    await requireAdmin()

    const address = (formData.get('address') as string)?.trim()
    if (!address) throw new Error('Address is required.')

    const contactName = (formData.get('contactName') as string)?.trim() || null
    const contactPhone = (formData.get('contactPhone') as string)?.trim() || null

    const [delivery] = await db
      .select({ id: deliveries.id })
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))
      .limit(1)

    if (!delivery) throw new Error('Delivery not found.')

    const [latestStop] = await db
      .select({ sequenceNumber: deliveryStops.sequenceNumber })
      .from(deliveryStops)
      .where(eq(deliveryStops.deliveryId, deliveryId))
      .orderBy(desc(deliveryStops.sequenceNumber))
      .limit(1)

    let lat: number | null = null
    let lng: number | null = null
    try {
      const coords = await geocodeAddress(address)
      lat = coords?.lat ?? null
      lng = coords?.lng ?? null
    } catch {}

    await db.insert(deliveryStops).values({
      deliveryId,
      orderId: null,
      customerId: null,
      sequenceNumber: (latestStop?.sequenceNumber ?? 0) + 1,
      address,
      contactName,
      contactPhone,
      contactEmail: null,
      lat: lat?.toFixed(7) ?? null,
      lng: lng?.toFixed(7) ?? null,
      status: 'pending',
    })

    await logActivityEvent({
      entityType: 'delivery',
      entityId: deliveryId,
      kind: 'delivery_stop_added',
      title: 'Stop added',
      body: `Manual stop at ${address} was added to the route.`,
    })

    revalidatePath(`/admin/deliveries/${deliveryId}`)
    revalidatePath('/driver/deliveries')
    revalidatePath('/driver/map')
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unable to add stop.'
  }

  if (errorMessage) {
    redirect(`/admin/deliveries/${deliveryId}?addStop=1&error=${encodeURIComponent(errorMessage)}`)
  }

  redirect(`/admin/deliveries/${deliveryId}`)
}

export async function setDeliveryOrigin(deliveryId: string, formData: FormData) {
  await requireAdminOrStaff()

  const address = (formData.get('originAddress') as string)?.trim()
  if (!address) {
    await db.update(deliveries).set({ originAddress: null, originLat: null, originLng: null }).where(eq(deliveries.id, deliveryId))
    revalidatePath(`/admin/deliveries/${deliveryId}`)
    return { success: true }
  }

  let lat: string | null = null
  let lng: string | null = null
  try {
    const geo = await geocodeAddress(address)
    if (geo) { lat = String(geo.lat); lng = String(geo.lng) }
  } catch { /* non-fatal */ }

  if (!lat || !lng) return { error: 'Could not geocode that address. Try a more specific address.' }

  await db.update(deliveries).set({ originAddress: address, originLat: lat, originLng: lng }).where(eq(deliveries.id, deliveryId))
  revalidatePath(`/admin/deliveries/${deliveryId}`)
  return { success: true }
}

export async function optimizeDeliveryRoute(deliveryId: string): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin()

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return { error: 'Google Maps API key not configured.' }

  // Fetch stops with coordinates
  const stops = await db
    .select({
      id: deliveryStops.id,
      sequenceNumber: deliveryStops.sequenceNumber,
      address: deliveryStops.address,
      lat: deliveryStops.lat,
      lng: deliveryStops.lng,
      status: deliveryStops.status,
    })
    .from(deliveryStops)
    .where(eq(deliveryStops.deliveryId, deliveryId))
    .orderBy(deliveryStops.sequenceNumber)

  // Only optimize pending stops that have coordinates
  const pending = stops.filter(s => s.status === 'pending' && s.lat && s.lng)
  if (pending.length < 2) return { error: 'Need at least 2 pending stops with coordinates to optimize.' }

  const [delivery] = await db
    .select({ originLat: deliveries.originLat, originLng: deliveries.originLng })
    .from(deliveries)
    .where(eq(deliveries.id, deliveryId))
  if (!delivery) return { error: 'Delivery not found.' }

  const originLat = delivery.originLat ? parseFloat(delivery.originLat) : null
  const originLng = delivery.originLng ? parseFloat(delivery.originLng) : null

  // Build Directions API request
  const origin =
    originLat && originLng
      ? `${originLat},${originLng}`
      : `${pending[0].lat},${pending[0].lng}`
  const destination = origin
  // Waypoints: all stops (or all but first if no origin)
  const waypoints = pending.map(s => `${s.lat},${s.lng}`)
  const waypointsParam = `optimize:true|${waypoints.join('|')}`

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypointsParam)}&key=${apiKey}`

  try {
    const res = await fetch(url)
    const data = await res.json() as {
      status: string
      routes?: Array<{ waypoint_order: number[] }>
    }

    if (data.status !== 'OK' || !data.routes?.[0]) {
      return { error: `Directions API returned: ${data.status}` }
    }

    const order = data.routes[0].waypoint_order // e.g. [2, 0, 1]

    // Reorder stops: completed stays in place, pending gets new sequence
    const completedStops = stops.filter(s => s.status !== 'pending')
    const completedCount = completedStops.length
    const reorderedPending = order.map(i => pending[i])

    // Assign sequence numbers: completed first, then optimized pending
    for (let i = 0; i < completedStops.length; i++) {
      await db.update(deliveryStops)
        .set({ sequenceNumber: i + 1 })
        .where(eq(deliveryStops.id, completedStops[i].id))
    }
    for (let i = 0; i < reorderedPending.length; i++) {
      await db.update(deliveryStops)
        .set({ sequenceNumber: completedCount + i + 1 })
        .where(eq(deliveryStops.id, reorderedPending[i].id))
    }

    revalidatePath(`/admin/deliveries/${deliveryId}`)
    return { success: true }
  } catch {
    return { error: 'Failed to call Directions API.' }
  }
}

export async function deleteDelivery(deliveryId: string) {
  await requireAdmin()
  await db.delete(deliveries).where(eq(deliveries.id, deliveryId))
  redirect('/admin/deliveries')
}
