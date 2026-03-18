'use server'

import { db } from '@/db'
import { deliveries, deliveryStops, orders, drivers, users, customerAccounts } from '@/db/schema'
import { requireAdmin, requireAdminOrStaff, requireRole } from '@/lib/auth/session'
import { and, count, desc, eq, inArray, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendSms } from '@/lib/telnyx/client'
import { postGoogleChat } from '@/lib/google-chat/webhook'
import { geocodeAddress } from '@/lib/maps/geocode'
import { generateSignedUploadUrl } from '@/lib/gcs/client'
import {
  sendDeliveryCompletedEmail,
  sendDriverDeliveryAssignmentEmail,
} from '@/lib/resend/client'
import { v4 as uuidv4 } from 'uuid'
import { createNotificationsForRoles, createUserNotification } from '@/lib/notifications/in-app'
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

function isMissingDeliveryStopContactColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const dbError = error as {
    code?: string
    message?: string
    column?: string
    cause?: unknown
  }

  if (dbError.code === '42703') return true
  if (dbError.column === 'contact_name' || dbError.column === 'contact_phone' || dbError.column === 'contact_email') {
    return true
  }

  const message = dbError.message?.toLowerCase() ?? ''
  if (
    message.includes('contact_name') ||
    message.includes('contact_phone') ||
    message.includes('contact_email')
  ) {
    return true
  }

  return isMissingDeliveryStopContactColumn(dbError.cause)
}

async function insertDeliveryStopWithFallback(
  values: {
    deliveryId: string
    orderId: string | null
    customerId: string | null
    sequenceNumber: number
    address: string
    contactName: string | null
    contactPhone: string | null
    contactEmail: string | null
    lat: string | null
    lng: string | null
    status: 'pending'
  }
) {
  try {
    await db.insert(deliveryStops).values(values)
  } catch (error) {
    if (!isMissingDeliveryStopContactColumn(error)) {
      throw error
    }

    await db.insert(deliveryStops).values({
      deliveryId: values.deliveryId,
      orderId: values.orderId,
      customerId: values.customerId,
      sequenceNumber: values.sequenceNumber,
      address: values.address,
      lat: values.lat,
      lng: values.lng,
      status: values.status,
    })
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

      await insertDeliveryStopWithFallback({
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

  if (driver?.phone && (driverPrefs?.smsNotificationsEnabled ?? true)) {
    await sendSms({
      to: driver.phone,
      body: `AHAWC Delivery Assigned: You have ${orderIds.length} stop(s) scheduled for ${weekStartDate}. Log in to view your route: ${process.env.NEXTAUTH_URL}/driver/deliveries`,
    })
  }

  if (driver?.email && (driverPrefs?.emailNotificationsEnabled ?? true)) {
    await sendDriverDeliveryAssignmentEmail({
      to: driver.email,
      driverName: driver.name,
      weekStartDate,
      stopCount: orderIds.length,
    })
  }

  const [driverUser] = await db
    .select({ userId: drivers.userId })
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1)

  if (driverUser?.userId) {
    await createUserNotification({
      userId: driverUser.userId,
      kind: 'delivery_assigned',
      title: 'New delivery assigned',
      body: `You have a new delivery run scheduled for ${weekStartDate}.`,
      href: '/driver/deliveries',
    })
  }

  await postGoogleChat(`Delivery Scheduled for ${weekStartDate}\nDriver: ${driver?.name}\nStops: ${orderIds.length}`)

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

      const deliveryUrl = `${process.env.NEXTAUTH_URL}/admin/deliveries/${stop.deliveryId}`
      const staffPhones = [
        process.env.ADMIN_NOTIFICATION_PHONE,
        '+12489339350',
        process.env.ORDER_NOTIFY_KRISTEN_PHONE,
      ].filter(Boolean) as string[]

      await Promise.allSettled([
        postGoogleChat(`✅ Delivery Run Completed\nAll stops finished.\n${deliveryUrl}`),
        ...staffPhones.map(phone =>
          sendSms({ to: phone, body: `AHAWC: All stops on a delivery run are now complete. View: ${deliveryUrl}`, bypassOptOut: true })
        ),
        createNotificationsForRoles({
          roles: ['admin', 'staff'],
          kind: 'delivery_completed',
          title: 'Delivery run completed',
          body: 'All stops on a delivery run have been completed.',
          href: `/admin/deliveries/${stop.deliveryId}`,
        }),
      ])
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
  const additionalPhotoUrl = ((formData.get('additionalPhotoUrl') as string) || '').trim() || null
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

  try {
    await db.update(deliveryStops)
      .set({
        status: 'delivered',
        completedAt: new Date(),
        notes,
        proofOfDeliveryUrl,
        shelfPhotoUrl,
        additionalPhotoUrl,
      })
      .where(eq(deliveryStops.id, stopId))
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
      ?? (error as { cause?: { code?: string } } | null)?.cause?.code
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    if (code !== '42703' && !message.includes('proof_of_delivery_url') && !message.includes('shelf_photo_url') && !message.includes('additional_photo_url')) {
      throw error
    }

    await db.update(deliveryStops)
      .set({
        status: 'delivered',
        completedAt: new Date(),
        notes,
      })
      .where(eq(deliveryStops.id, stopId))
  }

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

    const adminPhone = process.env.ADMIN_NOTIFICATION_PHONE
    const kimPhone = '+12489339350'
    const kristenPhone = process.env.ORDER_NOTIFY_KRISTEN_PHONE
    const staffPhones = [adminPhone, kimPhone, kristenPhone].filter(Boolean) as string[]
    const deliveryUrl = `${process.env.NEXTAUTH_URL}/admin/deliveries/${stop.deliveryId}`

    await Promise.allSettled([
      postGoogleChat(`✅ Delivery Run Completed\nAll stops finished for delivery ${stop.deliveryId}.\n${deliveryUrl}`),
      ...staffPhones.map(phone =>
        sendSms({
          to: phone,
          body: `AHAWC: All stops on a delivery run are now complete. View: ${deliveryUrl}`,
          bypassOptOut: true,
        })
      ),
      createNotificationsForRoles({
        roles: ['admin', 'staff'],
        kind: 'delivery_completed',
        title: 'Delivery run completed',
        body: 'All stops on a delivery run have been completed.',
        href: `/admin/deliveries/${stop.deliveryId}`,
      }),
    ])
  }

  const notificationPhone = stop.contactPhone || stop.accountPhone
  const notificationEmail = stop.contactEmail || stop.businessEmail || stop.accountEmail
  const accountPrefs = stop.customerId ? await getAccountPreferences(stop.customerId, null).catch(() => null) : null
  const deliveryTimeZone = accountPrefs?.timeZone ?? 'America/New_York'
  const deliveryDate = formatDateInTimeZone(new Date(), deliveryTimeZone)
  const prefersSms = stop.notificationPreference === 'sms' || stop.notificationPreference === 'both'
  const prefersEmail = !stop.notificationPreference || stop.notificationPreference === 'email' || stop.notificationPreference === 'both'

  if (notificationPhone && prefersSms) {
    await sendSms({
      to: notificationPhone,
      body: `AHAWC delivery update: your order for ${stop.companyName ?? stop.address} was delivered on ${deliveryDate} (${getShortTimeZoneLabel(deliveryTimeZone)}).`,
    }).catch(() => {})
  }

  if (notificationEmail && prefersEmail) {
    await sendDeliveryCompletedEmail({
      to: notificationEmail,
      companyName: stop.companyName ?? stop.address,
      deliveryDate,
      proofOfDeliveryUrl,
      shelfPhotoUrl,
    })
  }

  await Promise.all([
    createNotificationsForRoles({
      roles: ['admin'],
      kind: 'delivery_completed',
      title: 'Delivery completed',
      body: `${stop.companyName ?? 'A delivery stop'} was marked delivered.`,
      href: `/admin/deliveries/${stop.deliveryId}`,
    }),
    createNotificationsForRoles({
      roles: ['staff'],
      kind: 'delivery_completed',
      title: 'Delivery completed',
      body: `${stop.companyName ?? 'A delivery stop'} was marked delivered.`,
      href: null,
    }),
  ])

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
    .select({ phone: drivers.phone, name: users.name, email: users.email })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))
    .limit(1)

  if (driver?.phone) {
    await sendSms({
      to: driver.phone,
      body: `AHAWC Delivery Reassigned: You have been assigned a delivery scheduled for ${delivery.weekStartDate}. Log in to view your route: ${process.env.NEXTAUTH_URL}/driver/deliveries`,
    }).catch(() => {})
  }

  if (driver?.email) {
    const stopCount = await db
      .select({ id: deliveryStops.id })
      .from(deliveryStops)
      .where(eq(deliveryStops.deliveryId, deliveryId))

    await sendDriverDeliveryAssignmentEmail({
      to: driver.email,
      driverName: driver.name,
      weekStartDate: delivery.weekStartDate,
      stopCount: stopCount.length,
    })
  }

  const [driverUser] = await db
    .select({ userId: drivers.userId })
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1)

  await logActivityEvent({
    entityType: 'delivery',
    entityId: deliveryId,
    kind: 'delivery_reassigned',
    title: 'Driver reassigned',
    body: driver ? `Delivery reassigned to ${driver.name}.` : 'Delivery driver was reassigned.',
  })

  if (driverUser?.userId) {
    await createUserNotification({
      userId: driverUser.userId,
      kind: 'delivery_reassigned',
      title: 'Delivery reassigned',
      body: `A delivery run scheduled for ${delivery.weekStartDate} has been assigned to you.`,
      href: '/driver/deliveries',
    })
  }

  await postGoogleChat(`Delivery Reassigned for ${delivery.weekStartDate}\nDriver: ${driver?.name ?? 'Unknown'}`)

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

    await insertDeliveryStopWithFallback({
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

    await insertDeliveryStopWithFallback({
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

export async function deleteDelivery(deliveryId: string) {
  await requireAdmin()
  await db.delete(deliveries).where(eq(deliveries.id, deliveryId))
  redirect('/admin/deliveries')
}
