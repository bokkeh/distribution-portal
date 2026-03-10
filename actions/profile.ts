'use server'

import { db } from '@/db'
import { users, customerAccounts } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

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
