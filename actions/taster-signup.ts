'use server'

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

export type TasterSignupState =
  | null
  | { success: true; email: string }
  | { error: string }

export async function registerTaster(
  _prev: TasterSignupState,
  formData: FormData,
): Promise<TasterSignupState> {
  const inviteCode = (formData.get('inviteCode') as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const phone = (formData.get('phone') as string)?.trim() || null

  if (!name || !email || !password) {
    return { error: 'Name, email, and password are required.' }
  }

  const expectedInviteCode = process.env.TASTER_SIGNUP_INVITE_CODE?.trim()
  if (!expectedInviteCode) {
    return { error: 'Taster self-signup is disabled until an invite code is configured.' }
  }

  if (!inviteCode || inviteCode !== expectedInviteCode) {
    return { error: 'A valid taster invite code is required.' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing.length > 0) {
    return { error: 'An account with that email already exists. Try signing in.' }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await db.insert(users).values({
    name,
    email,
    passwordHash,
    role: 'taster',
    roles: ['taster'],
    phone,
    active: false,
  })

  return { success: true, email }
}
