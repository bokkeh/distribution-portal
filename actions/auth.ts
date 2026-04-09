'use server'

import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { signIn, signOut } from '@/lib/auth/config'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, users } from '@/db/schema'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password.' }
        default:
          return { error: 'Something went wrong.' }
      }
    }
    throw error
  }

  redirect('/admin/dashboard')
}

export async function registerCustomerAccount(input: {
  name: string
  companyName: string
  email: string
  password: string
  phone?: string
}) {
  const name = input.name.trim()
  const companyName = input.companyName.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password
  const phone = input.phone?.trim() || null

  if (!name || !companyName || !email || !password) {
    return { error: 'Name, company name, email, and password are required.' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingUser) {
    return { error: 'An account with that email already exists. Sign in instead.' }
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const [user] = await db.insert(users).values({
    name,
    email,
    passwordHash,
    role: 'customer',
    roles: ['customer'],
    phone,
    active: true,
  }).returning({ id: users.id })

  await db.insert(customerAccounts).values({
    userId: user.id,
    companyName,
    contactName: name,
    phone,
    email,
    businessEmail: email,
    businessPhone: phone,
    creditLimit: '0',
    paymentTerms: 'PREPAID',
  })

  return { success: true as const, email }
}

export async function logout() {
  await signOut({ redirectTo: '/login' })
}
