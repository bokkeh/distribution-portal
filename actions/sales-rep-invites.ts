'use server'

import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { salesMembers, salesRepInvites, users } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { sendSalesRepInviteEmail } from '@/lib/resend/client'

const SALES_REP_INVITE_TTL_DAYS = 14

export type SalesRepInviteSignupState =
  | null
  | { success: true; email: string }
  | { error: string }

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function buildInviteUrl(token: string) {
  const base = process.env.NEXTAUTH_URL ?? 'https://portal.ahawc.com'
  return `${base}/sales-rep-signup?token=${encodeURIComponent(token)}`
}

function isMissingInviteTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('sales_rep_invites') && message.includes('does not exist')
}

export async function createSalesRepInvite(input: {
  email: string
  name?: string
  phone?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdminOrStaff()
    const email = input.email.trim().toLowerCase()
    const name = input.name?.trim() || null
    const phone = input.phone?.trim() || null

    if (!email) return { success: false, error: 'Email is required.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Enter a valid email address.' }
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser) {
      return { success: false, error: 'A portal user with that email already exists.' }
    }

    await db
      .update(salesRepInvites)
      .set({ status: 'revoked' })
      .where(and(eq(salesRepInvites.email, email), eq(salesRepInvites.status, 'pending')))

    const rawToken = randomBytes(24).toString('base64url')
    const tokenHash = hashInviteToken(rawToken)
    const expiresAt = new Date(Date.now() + SALES_REP_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

    await db.insert(salesRepInvites).values({
      email,
      name,
      phone,
      tokenHash,
      invitedByUserId: session.user.id,
      expiresAt,
    })

    await sendSalesRepInviteEmail({
      to: email,
      invitedName: name,
      senderName: session.user.name ?? 'AHAWC',
      inviteUrl: buildInviteUrl(rawToken),
      expiresAt,
    })

    revalidatePath('/admin/sales/members')
    return { success: true }
  } catch (error) {
    if (isMissingInviteTable(error)) {
      return { success: false, error: 'Sales rep invites are not enabled yet. Run npm run db:push and try again.' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invite.',
    }
  }
}

export async function getSalesRepInviteByToken(rawToken: string) {
  const token = rawToken.trim()
  if (!token) return null

  try {
    const tokenHash = hashInviteToken(token)
    const [invite] = await db
      .select({
        id: salesRepInvites.id,
        email: salesRepInvites.email,
        name: salesRepInvites.name,
        phone: salesRepInvites.phone,
        status: salesRepInvites.status,
        expiresAt: salesRepInvites.expiresAt,
      })
      .from(salesRepInvites)
      .where(eq(salesRepInvites.tokenHash, tokenHash))
      .limit(1)

    if (!invite) return null
    return invite
  } catch (error) {
    if (isMissingInviteTable(error)) return null
    throw error
  }
}

export async function acceptSalesRepInvite(
  _prev: SalesRepInviteSignupState,
  formData: FormData,
): Promise<SalesRepInviteSignupState> {
  try {
    const token = (formData.get('token') as string)?.trim()
    const name = (formData.get('name') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const phone = (formData.get('phone') as string)?.trim() || null
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!token || !name || !email || !password) {
      return { error: 'Name, email, and password are required.' }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'Enter a valid email address.' }
    }

    if (password.length < 8) {
      return { error: 'Password must be at least 8 characters.' }
    }

    if (password !== confirmPassword) {
      return { error: 'Passwords do not match.' }
    }

    const tokenHash = hashInviteToken(token)
    const [invite] = await db
      .select()
      .from(salesRepInvites)
      .where(eq(salesRepInvites.tokenHash, tokenHash))
      .limit(1)

    if (!invite) {
      return { error: 'This invite link is invalid.' }
    }

    if (invite.status !== 'pending') {
      return { error: 'This invite has already been used or is no longer active.' }
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      await db
        .update(salesRepInvites)
        .set({ status: 'expired' })
        .where(eq(salesRepInvites.id, invite.id))
      return { error: 'This invite has expired. Ask an admin to send a new one.' }
    }

    if (invite.email.toLowerCase() !== email) {
      return { error: 'Use the same email address that received the invite.' }
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existingUser) {
      return { error: 'A user with that email already exists. Sign in instead or ask an admin for help.' }
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const [user] = await db.insert(users).values({
      name,
      email,
      passwordHash,
      role: 'sales_rep',
      roles: ['sales_rep'],
      phone,
      active: true,
    }).returning({ id: users.id })

    await db.insert(salesMembers).values({
      userId: user.id,
      status: 'active',
      onboardingStatus: 'complete',
    })

    await db
      .update(salesRepInvites)
      .set({
        status: 'accepted',
        acceptedUserId: user.id,
        acceptedAt: new Date(),
      })
      .where(eq(salesRepInvites.id, invite.id))

    revalidatePath('/admin/sales/members')
    revalidatePath('/admin/users')

    return { success: true, email }
  } catch (error) {
    if (isMissingInviteTable(error)) {
      return { error: 'Sales rep invites are not enabled yet. Run npm run db:push and try again.' }
    }
    return { error: error instanceof Error ? error.message : 'Unable to create account from invite.' }
  }
}

export async function getRecentSalesRepInvites() {
  await requireAdminOrStaff()

  try {
    return await db
      .select({
        id: salesRepInvites.id,
        email: salesRepInvites.email,
        name: salesRepInvites.name,
        phone: salesRepInvites.phone,
        status: salesRepInvites.status,
        createdAt: salesRepInvites.createdAt,
        expiresAt: salesRepInvites.expiresAt,
      })
      .from(salesRepInvites)
      .where(inArray(salesRepInvites.status, ['pending', 'accepted']))
      .orderBy(salesRepInvites.createdAt)
  } catch (error) {
    if (isMissingInviteTable(error)) return []
    throw error
  }
}
