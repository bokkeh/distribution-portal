'use server'

import { db } from '@/db'
import { deliveries, deliveryStops, orders, drivers, users, customerAccounts } from '@/db/schema'
import { requireAdmin, requireAdminOrStaff } from '@/lib/auth/session'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendSms } from '@/lib/telnyx/client'
import { postGoogleChat } from '@/lib/google-chat/webhook'
import { geocodeAddress } from '@/lib/maps/geocode'

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
    customerId: string
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

  const [driver] = await db
    .select({ phone: drivers.phone, name: users.name })
    .from(drivers)
    .innerJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId))

  if (driver?.phone) {
    await sendSms({
      to: driver.phone,
      body: `AHAWC Delivery Assigned: You have ${orderIds.length} stop(s) scheduled for ${weekStartDate}. Log in to view your route: ${process.env.NEXTAUTH_URL}/driver/deliveries`,
    })
  }

  await postGoogleChat(`Delivery Scheduled for ${weekStartDate}\nDriver: ${driver?.name}\nStops: ${orderIds.length}`)

  revalidatePath('/admin/deliveries')
  redirect(`/admin/deliveries/${delivery.id}`)
}

export async function updateStopStatus(stopId: string, status: 'delivered' | 'failed') {
  await requireAdminOrStaff()
  await db.update(deliveryStops)
    .set({ status, completedAt: status === 'delivered' ? new Date() : null })
    .where(eq(deliveryStops.id, stopId))
  revalidatePath('/driver/deliveries')
}

export async function addDeliveryStop(deliveryId: string, formData: FormData) {
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

    revalidatePath(`/admin/deliveries/${deliveryId}`)
    revalidatePath('/driver/deliveries')
    revalidatePath('/driver/map')
    redirect(`/admin/deliveries/${deliveryId}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to add stop.'
    redirect(`/admin/deliveries/${deliveryId}?addStop=1&error=${encodeURIComponent(message)}`)
  }
}
