'use server'

import { db } from '@/db'
import { deliveries, deliveryStops, orders, drivers, users, customerAccounts } from '@/db/schema'
import { requireAdmin, requireAdminOrStaff } from '@/lib/auth/session'
import { eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendSms } from '@/lib/telnyx/client'
import { postGoogleChat } from '@/lib/google-chat/webhook'
import { geocodeAddress } from '@/lib/maps/geocode'

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
