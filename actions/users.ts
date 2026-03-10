'use server'

import { db } from '@/db'
import { users, customerAccounts, drivers } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createUser(formData: FormData) {
  await requireAdmin()

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as 'admin' | 'staff' | 'driver' | 'customer'
  const phone = formData.get('phone') as string | null

  const passwordHash = await bcrypt.hash(password, 12)

  const [user] = await db.insert(users).values({
    name, email, passwordHash, role, phone: phone || null,
  }).returning()

  if (role === 'customer') {
    const companyName = formData.get('companyName') as string
    if (companyName) {
      await db.insert(customerAccounts).values({
        userId: user.id,
        companyName,
        contactName: formData.get('contactName') as string || null,
        address: formData.get('address') as string || null,
        city: formData.get('city') as string || null,
        state: formData.get('state') as string || null,
        zip: formData.get('zip') as string || null,
        phone: phone || null,
        email,
        dcAbraNumber: formData.get('dcAbraNumber') as string || null,
        creditLimit: formData.get('creditLimit') as string || '0',
        paymentTerms: formData.get('paymentTerms') as string || 'NET30',
      })
    }
  }

  if (role === 'driver') {
    await db.insert(drivers).values({
      userId: user.id,
      phone: phone ?? '',
    })
  }

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function deactivateUser(userId: string) {
  await requireAdmin()
  await db.update(users).set({ active: false }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}

export async function activateUser(userId: string) {
  await requireAdmin()
  await db.update(users).set({ active: true }).where(eq(users.id, userId))
  revalidatePath('/admin/users')
}
