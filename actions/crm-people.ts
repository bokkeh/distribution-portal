'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { communityContacts, contacts, customerAccounts } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { isCommunitySignupRateLimited } from '@/lib/auth/rate-limit'

export type PersonActionState = {
  success?: boolean
  error?: string
  kind?: 'company' | 'community'
}

const personSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  email: z.string().trim().email('Enter a valid email address.').max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7, 'Enter a valid phone number.').max(40),
})

function parsePerson(formData: FormData) {
  return personSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
  })
}

async function upsertCommunityContact({
  firstName,
  lastName,
  email,
  phone,
  source,
  createdByUserId,
}: z.infer<typeof personSchema> & {
  source: 'public_signup' | 'admin_entry'
  createdByUserId?: string | null
}) {
  const now = new Date()
  await db.insert(communityContacts).values({
    firstName,
    lastName,
    email,
    phone,
    source,
    status: 'subscribed',
    marketingConsentAt: now,
    createdByUserId: createdByUserId ?? null,
  }).onConflictDoUpdate({
    target: communityContacts.email,
    set: {
      firstName,
      lastName,
      phone,
      status: 'subscribed',
      marketingConsentAt: now,
      updatedAt: now,
    },
  })
}

export async function createCrmPerson(
  _previousState: PersonActionState | null,
  formData: FormData,
): Promise<PersonActionState> {
  try {
    const session = await requireRole('admin')
    const parsed = parsePerson(formData)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the person details.' }

    const kind = formData.get('kind') === 'company' ? 'company' : 'community'
    if (kind === 'community') {
      await upsertCommunityContact({ ...parsed.data, source: 'admin_entry', createdByUserId: session.user.id })
      revalidatePath('/admin/crm')
      return { success: true, kind }
    }

    const customerId = String(formData.get('customerId') ?? '').trim()
    if (!customerId) return { error: 'Choose the company account for this contact.' }
    const [account] = await db.select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, customerId))
      .limit(1)
    if (!account) return { error: 'Company account not found.' }

    const duplicate = await db.select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.customerId, customerId), eq(contacts.email, parsed.data.email)))
      .limit(1)
    if (duplicate[0]) return { error: 'That email is already a contact for this company.' }

    await db.insert(contacts).values({
      customerId,
      name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      email: parsed.data.email,
      phone: parsed.data.phone,
      phoneType: 'mobile',
      preferredContact: 'email',
    })
    revalidatePath('/admin/crm')
    revalidatePath(`/admin/crm/${customerId}`)
    revalidatePath(`/admin/crm/${customerId}/contacts`)
    return { success: true, kind }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to add this person.' }
  }
}

export async function joinBrandCommunity(
  _previousState: PersonActionState | null,
  formData: FormData,
): Promise<PersonActionState> {
  try {
    if (String(formData.get('website') ?? '').trim()) return { success: true, kind: 'community' }

    const requestHeaders = await headers()
    const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? requestHeaders.get('x-real-ip')
      ?? 'unknown'
    if (await isCommunitySignupRateLimited(ip)) {
      return { error: 'Too many signup attempts. Please try again later.' }
    }

    const parsed = parsePerson(formData)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check your details.' }
    if (formData.get('marketingConsent') !== 'on') {
      return { error: 'Please agree to receive brand news and updates.' }
    }

    await upsertCommunityContact({ ...parsed.data, source: 'public_signup' })
    revalidatePath('/admin/crm')
    return { success: true, kind: 'community' }
  } catch (error) {
    console.error('Community signup failed:', error)
    return { error: 'We could not save your signup. Please try again.' }
  }
}
