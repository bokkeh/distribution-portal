'use server'

import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { customerAccounts, customerPortalInvites, users } from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'
import { sendCustomerPortalActivationEmail, sendCustomerPortalReadyEmail } from '@/lib/resend/client'

const CUSTOMER_INVITE_TTL_DAYS = 14

export type CustomerPortalSignupState =
  | null
  | { success: true; email: string }
  | { error: string }

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function buildInviteUrl(token: string) {
  const base = process.env.NEXTAUTH_URL ?? 'https://portal.ahawc.com'
  return `${base}/customer-activate?token=${encodeURIComponent(token)}`
}

export async function provisionCustomerPortalAccess(input: {
  requestId: string
  accountId: string
  email: string
  businessName: string
  invitedByUserId: string
  senderName: string
  personalMessage?: string | null
}) {
  const email = input.email.trim().toLowerCase()
  const [account] = await db
    .select({
      id: customerAccounts.id,
      userId: customerAccounts.userId,
      email: customerAccounts.email,
      businessEmail: customerAccounts.businessEmail,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, input.accountId))
    .limit(1)

  if (!account) throw new Error('The selected CRM account could not be found.')

  if (account.userId) {
    const [linkedUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, account.userId))
      .limit(1)

    if (!linkedUser || linkedUser.email.toLowerCase() !== email) {
      throw new Error('This CRM account is already linked to a different portal user.')
    }

    await sendCustomerPortalReadyEmail({
      to: email,
      businessName: input.businessName,
      senderName: input.senderName,
    })
    return { kind: 'existing' as const, userId: linkedUser.id }
  }

  const [existingUser] = await db
    .select({ id: users.id, roles: users.roles })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existingUser) {
    const [otherAccount] = await db
      .select({ id: customerAccounts.id })
      .from(customerAccounts)
      .where(and(eq(customerAccounts.userId, existingUser.id), ne(customerAccounts.id, account.id)))
      .limit(1)

    if (otherAccount) {
      throw new Error('That email is already linked to another CRM account.')
    }

    const roles = Array.from(new Set([...(existingUser.roles ?? []), 'customer']))
    await db.update(users).set({ roles, active: true }).where(eq(users.id, existingUser.id))
    await db.update(customerAccounts).set({
      userId: existingUser.id,
      email: account.email || email,
      businessEmail: account.businessEmail || email,
    }).where(eq(customerAccounts.id, account.id))

    await sendCustomerPortalReadyEmail({
      to: email,
      businessName: input.businessName,
      senderName: input.senderName,
    })
    return { kind: 'linked' as const, userId: existingUser.id }
  }

  await db.update(customerPortalInvites).set({ status: 'revoked' }).where(and(
    eq(customerPortalInvites.accountId, account.id),
    eq(customerPortalInvites.status, 'pending'),
  ))

  const rawToken = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + CUSTOMER_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(customerPortalInvites).values({
    requestId: input.requestId,
    accountId: account.id,
    email,
    tokenHash: hashInviteToken(rawToken),
    invitedByUserId: input.invitedByUserId,
    expiresAt,
  })

  await db.update(customerAccounts).set({
    email: account.email || email,
    businessEmail: account.businessEmail || email,
  }).where(eq(customerAccounts.id, account.id))

  await sendCustomerPortalActivationEmail({
    to: email,
    businessName: input.businessName,
    senderName: input.senderName,
    inviteUrl: buildInviteUrl(rawToken),
    expiresAt,
    personalMessage: input.personalMessage,
  })

  return { kind: 'invited' as const }
}

export async function getCustomerPortalInviteByToken(rawToken: string) {
  const token = rawToken.trim()
  if (!token) return null

  const [invite] = await db
    .select({
      id: customerPortalInvites.id,
      email: customerPortalInvites.email,
      accountId: customerPortalInvites.accountId,
      businessName: customerAccounts.companyName,
      contactName: customerAccounts.contactName,
      phone: customerAccounts.phone,
      status: customerPortalInvites.status,
      expiresAt: customerPortalInvites.expiresAt,
    })
    .from(customerPortalInvites)
    .innerJoin(customerAccounts, eq(customerAccounts.id, customerPortalInvites.accountId))
    .where(eq(customerPortalInvites.tokenHash, hashInviteToken(token)))
    .limit(1)

  return invite ? { ...invite, isValid: invite.status === 'pending' && invite.expiresAt.getTime() >= Date.now() } : null
}

export async function acceptCustomerPortalInvite(
  _prev: CustomerPortalSignupState,
  formData: FormData,
): Promise<CustomerPortalSignupState> {
  try {
    const token = String(formData.get('token') ?? '').trim()
    const name = String(formData.get('name') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const confirmPassword = String(formData.get('confirmPassword') ?? '')

    if (!token || !name || !password) return { error: 'Name and password are required.' }
    if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
    if (password !== confirmPassword) return { error: 'Passwords do not match.' }

    const [invite] = await db
      .select()
      .from(customerPortalInvites)
      .where(eq(customerPortalInvites.tokenHash, hashInviteToken(token)))
      .limit(1)

    if (!invite) return { error: 'This activation link is invalid.' }
    if (invite.status !== 'pending') return { error: 'This activation link has already been used or revoked.' }

    if (invite.expiresAt.getTime() < Date.now()) {
      await db.update(customerPortalInvites).set({ status: 'expired' }).where(eq(customerPortalInvites.id, invite.id))
      return { error: 'This activation link has expired. Ask AHAWC to resend it.' }
    }

    const [account] = await db.select({ userId: customerAccounts.userId }).from(customerAccounts)
      .where(eq(customerAccounts.id, invite.accountId)).limit(1)
    if (!account) return { error: 'The CRM account linked to this invitation no longer exists.' }
    if (account.userId) return { error: 'This CRM account already has portal access. Sign in or reset the password.' }

    const [existingUser] = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, invite.email)).limit(1)
    if (existingUser) return { error: 'A portal user with this email already exists. Ask AHAWC to link the existing user.' }

    const [user] = await db.insert(users).values({
      name,
      email: invite.email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'customer',
      roles: ['customer'],
      active: true,
    }).returning({ id: users.id })

    await db.update(customerAccounts).set({ userId: user.id }).where(and(
      eq(customerAccounts.id, invite.accountId),
      // Protect against a concurrent activation.
      isNull(customerAccounts.userId),
    ))

    await db.update(customerPortalInvites).set({
      status: 'accepted',
      acceptedUserId: user.id,
      acceptedAt: new Date(),
    }).where(and(
      eq(customerPortalInvites.id, invite.id),
      eq(customerPortalInvites.status, 'pending'),
    ))

    await logActivityEvent({
      entityType: 'account',
      entityId: invite.accountId,
      actorUserId: user.id,
      kind: 'customer_portal_activated',
      title: 'Customer portal access activated',
      body: `${invite.email} created portal credentials.`,
      metadata: { email: invite.email, inviteId: invite.id },
    })

    revalidatePath('/admin/users')
    revalidatePath(`/admin/crm/${invite.accountId}`)
    return { success: true, email: invite.email }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to activate portal access.' }
  }
}
