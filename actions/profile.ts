'use server'

import { db } from '@/db'
import { users, customerAccounts, drivers } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { generateSignedUploadUrl } from '@/lib/gcs/client'
import { geocodeAddress } from '@/lib/maps/geocode'
import { v4 as uuidv4 } from 'uuid'

export async function updateProfile(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const session = await requireAuth()
    const userId = formData.get('userId') as string
    if (session.user.id !== userId) throw new Error('Unauthorized')

    // Update user record
    await db.update(users).set({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || null,
    }).where(eq(users.id, userId))

    // Update customer account if it exists
    const accountId = formData.get('accountId') as string | null
    if (accountId) {
      await db.update(customerAccounts).set({
        companyName: (formData.get('companyName') as string) || undefined,
        address: (formData.get('address') as string) || null,
        city: (formData.get('city') as string) || null,
        state: (formData.get('state') as string) || null,
        zip: (formData.get('zip') as string) || null,
        dcAbraNumber: (formData.get('dcAbraNumber') as string) || null,
        businessEmail: (formData.get('businessEmail') as string) || null,
        businessPhone: (formData.get('businessPhone') as string) || null,
        notificationPreference: (formData.get('notificationPreference') as string) || 'email',
        pocName: (formData.get('pocName') as string) || null,
        pocPhone: (formData.get('pocPhone') as string) || null,
        pocEmail: (formData.get('pocEmail') as string) || null,
        hoursOfOperation: (formData.get('hoursOfOperation') as string) || null,
        preferredDeliveryDays: (formData.get('preferredDeliveryDays') as string) || null,
        preferredDeliveryTimes: (formData.get('preferredDeliveryTimes') as string) || null,
        additionalLocations: (formData.get('additionalLocations') as string) || null,
      }).where(eq(customerAccounts.id, accountId))
    }

    revalidatePath('/customer/profile')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateSimpleProfile(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const session = await requireAuth()
    const userId = formData.get('userId') as string
    if (session.user.id !== userId) throw new Error('Unauthorized')

    await db.update(users).set({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || null,
    }).where(eq(users.id, userId))

    revalidatePath('/admin/profile')
    revalidatePath('/staff/profile')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateDriverProfile(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const session = await requireAuth()
    const userId = formData.get('userId') as string
    if (session.user.id !== userId) throw new Error('Unauthorized')

    await db.update(users).set({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: (formData.get('phone') as string) || null,
    }).where(eq(users.id, userId))

    const driverId = formData.get('driverId') as string | null
    if (driverId) {
      const homeAddress = (formData.get('homeAddress') as string) || null
      const homeCity = (formData.get('homeCity') as string) || null
      const homeState = (formData.get('homeState') as string) || null
      const homeZip = (formData.get('homeZip') as string) || null
      const fullHomeAddress = [homeAddress, homeCity, homeState, homeZip].filter(Boolean).join(', ')
      let homeLat: string | null = null
      let homeLng: string | null = null

      if (fullHomeAddress) {
        try {
          const coords = await geocodeAddress(fullHomeAddress)
          homeLat = coords?.lat?.toFixed(7) ?? null
          homeLng = coords?.lng?.toFixed(7) ?? null
        } catch {}
      }

      await db.update(drivers).set({
        vehicleMake: (formData.get('vehicleMake') as string) || null,
        vehicleModel: (formData.get('vehicleModel') as string) || null,
        vehicleYear: (formData.get('vehicleYear') as string) || null,
        vin: (formData.get('vin') as string) || null,
        licensePlate: (formData.get('licensePlate') as string) || null,
        vehicleImageUrl: (formData.get('vehicleImageUrl') as string) || null,
        homeAddress,
        homeCity,
        homeState,
        homeZip,
        homeLat,
        homeLng,
        phone: (formData.get('phone') as string) || '',
      }).where(eq(drivers.id, driverId))
    }

    revalidatePath('/driver/profile')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

export async function getVehiclePhotoUploadUrl(
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string; error?: string }> {
  try {
    await requireAuth()
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
    const filename = `vehicle-${uuidv4()}.${ext}`
    return await generateSignedUploadUrl(filename, contentType, 'vehicles')
  } catch (err) {
    return { uploadUrl: '', publicUrl: '', error: err instanceof Error ? err.message : String(err) }
  }
}
