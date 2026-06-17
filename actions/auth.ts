'use server'

import bcrypt from 'bcryptjs'
import { asc, eq, or, sql } from 'drizzle-orm'
import { signIn, signOut } from '@/lib/auth/config'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { customerAccounts, users } from '@/db/schema'
import { normalizeBusinessType } from '@/lib/customers/business-types'
import { normalizeAccountGeography } from '@/lib/pricing/geographic-service'

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
  businessType?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
}) {
  const name = input.name.trim()
  const companyName = input.companyName.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password
  const businessType = normalizeBusinessType(input.businessType)
  const phone = input.phone?.trim() || null
  const address = input.address?.trim() || null
  const city = input.city?.trim() || null
  const state = input.state?.trim() || null
  const zip = input.zip?.trim() || null
  const normalizedGeography = normalizeAccountGeography({ state, county: null })

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

  const normalizeMatchText = (value: string | null | undefined) =>
    value
      ?.trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      ?? ''

  const normalizeZip = (value: string | null | undefined) => value?.replace(/\s+/g, '') ?? ''
  const normalizedCompanyName = normalizeMatchText(companyName)
  const normalizedAddress = normalizeMatchText(address)
  const normalizedCity = normalizeMatchText(city)
  const normalizedState = normalizedGeography.state?.trim().toUpperCase() ?? ''
  const normalizedZip = normalizeZip(zip)

  const candidateConditions = [
    sql<boolean>`lower(regexp_replace(trim(coalesce(${customerAccounts.companyName}, '')), '\s+', ' ', 'g')) = ${normalizedCompanyName}`,
  ]

  if (normalizedAddress) {
    candidateConditions.push(sql<boolean>`
      lower(regexp_replace(trim(coalesce(${customerAccounts.address}, '')), '\s+', ' ', 'g')) = ${normalizedAddress}
    `)
  }

  const matchingAccounts = await db
    .select({
      id: customerAccounts.id,
      userId: customerAccounts.userId,
      companyName: customerAccounts.companyName,
      contactName: customerAccounts.contactName,
      address: customerAccounts.address,
      city: customerAccounts.city,
      state: customerAccounts.state,
      zip: customerAccounts.zip,
      phone: customerAccounts.phone,
      email: customerAccounts.email,
      businessType: customerAccounts.businessType,
      businessEmail: customerAccounts.businessEmail,
      businessPhone: customerAccounts.businessPhone,
      createdAt: customerAccounts.createdAt,
    })
    .from(customerAccounts)
    .where(or(...candidateConditions))
    .orderBy(asc(customerAccounts.createdAt))
    .limit(10)

  const matchedAccount = matchingAccounts
    .map((account) => {
      const companyMatches = normalizeMatchText(account.companyName) === normalizedCompanyName
      const addressMatches = Boolean(
        normalizedAddress
        && normalizeMatchText(account.address) === normalizedAddress
        && (!normalizedCity || normalizeMatchText(account.city) === normalizedCity)
        && (!normalizedState || (account.state?.trim().toUpperCase() ?? '') === normalizedState)
        && (!normalizedZip || normalizeZip(account.zip) === normalizedZip)
      )

      return {
        ...account,
        companyMatches,
        addressMatches,
        score: (addressMatches ? 3 : 0) + (companyMatches ? 2 : 0) + (account.userId ? 0 : 0.5),
      }
    })
    .filter((account) => account.companyMatches || account.addressMatches)
    .sort((left, right) => right.score - left.score)
    .at(0)

  if (matchedAccount?.userId) {
    return {
      error: 'A CRM account for this business is already linked to a portal user. Sign in with the approved account or ask an admin to review the account link.',
    }
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

  if (matchedAccount) {
    await db.update(customerAccounts).set({
      userId: user.id,
      companyName: matchedAccount.companyName || companyName,
      contactName: matchedAccount.contactName ?? name,
      address: matchedAccount.address ?? address,
      city: matchedAccount.city ?? city,
      state: matchedAccount.state ?? normalizedGeography.state,
      zip: matchedAccount.zip ?? zip,
      phone: matchedAccount.phone ?? phone,
      email: matchedAccount.email ?? email,
      businessType: businessType ?? normalizeBusinessType(matchedAccount.businessType),
      businessEmail: matchedAccount.businessEmail ?? email,
      businessPhone: matchedAccount.businessPhone ?? phone,
    }).where(eq(customerAccounts.id, matchedAccount.id))
  } else {
    await db.insert(customerAccounts).values({
      userId: user.id,
      companyName,
      contactName: name,
      address,
      city,
      state: normalizedGeography.state,
      zip,
      phone,
      email,
      businessType,
      businessEmail: email,
      businessPhone: phone,
      creditLimit: '0',
      paymentTerms: 'PREPAID',
    })
  }

  return { success: true as const, email }
}

export async function registerAndSignInPartner(formData: FormData) {
  const input = {
    name: (formData.get('name') as string) ?? '',
    companyName: (formData.get('companyName') as string) ?? '',
    email: (formData.get('email') as string) ?? '',
    password: (formData.get('password') as string) ?? '',
    businessType: (formData.get('businessType') as string) ?? '',
    phone: (formData.get('phone') as string) ?? '',
    address: (formData.get('address') as string) ?? '',
    city: (formData.get('city') as string) ?? '',
    state: (formData.get('state') as string) ?? '',
    zip: (formData.get('zip') as string) ?? '',
  }

  const result = await registerCustomerAccount(input)
  if ('error' in result) return result

  try {
    await signIn('credentials', { email: input.email, password: input.password, redirect: false })
  } catch {
    // sign-in errors don't block — user can log in manually
  }

  redirect('/customer/products')
}

export async function logout() {
  await signOut({ redirectTo: '/login' })
}
