'use server'

import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAuth } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const session = await requireAuth()
  const userId = formData.get('userId') as string

  if (session.user.id !== userId) throw new Error('Unauthorized')

  await db.update(users).set({
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string || null,
  }).where(eq(users.id, userId))

  revalidatePath('/customer/profile')
}
