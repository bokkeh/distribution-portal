'use server'

import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { tasterInvites, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { sendTasterInviteEmail } from '@/lib/resend/client'

const TASTER_INVITE_TTL_DAYS = 14

export type TasterInviteAcceptState =
  | null
  | { success: true; email: string }
  | { error: string }

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function buildInviteUrl(token: string) {
  const base = process.env.NEXTAUTH_URL ?? 'https://portal.ahawc.com'
  return `${base}/taster-invite/${encodeURIComponent(token)}`
}

function isMissingInviteTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('taster_invites') && message.includes('does not exist')
}

/** Creates the invite row + sends the email. Called right after the taster's user row is inserted. */
export async function createTasterInvite({
  userId,
  email,
  name,
  invitedByUserId,
  invitedByName,
}: {
  userId: string
  email: string
  name: string
  invitedByUserId: string
  invitedByName: string
}): Promise<{ inviteUrl: string; expiresAt: Date }> {
  const rawToken = randomBytes(24).toString('base64url')
  const tokenHash = hashInviteToken(rawToken)
  const expiresAt = new Date(Date.now() + TASTER_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(tasterInvites).values({
    userId,
    tokenHash,
    createdByUserId: invitedByUserId,
    expiresAt,
  })

  const inviteUrl = buildInviteUrl(rawToken)

  await sendTasterInviteEmail({
    to: email,
    invitedName: name,
    senderName: invitedByName,
    inviteUrl,
    expiresAt,
  })

  await logActivityEvent({
    entityType: 'user',
    entityId: userId,
    actorUserId: invitedByUserId,
    kind: 'taster_invited',
    title: 'Taster invitation sent',
    metadata: { email },
  })

  return { inviteUrl, expiresAt }
}

export async function resendTasterInvite(userId: string): Promise<{ success: boolean; error?: string; inviteUrl?: string }> {
  try {
    const session = await requireAdmin()

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, accountStatus: users.accountStatus })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) return { success: false, error: 'Taster not found.' }
    if (user.accountStatus === 'active') {
      return { success: false, error: 'This taster has already activated their account.' }
    }

    await db
      .update(tasterInvites)
      .set({ status: 'revoked' })
      .where(eq(tasterInvites.userId, userId))

    const { inviteUrl } = await createTasterInvite({
      userId: user.id,
      email: user.email,
      name: user.name,
      invitedByUserId: session.user.id,
      invitedByName: session.user.name ?? 'AHAWC',
    })

    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userId}`)

    return { success: true, inviteUrl }
  } catch (error) {
    if (isMissingInviteTable(error)) {
      return { success: false, error: 'Taster invites are not enabled yet. Run npm run db:push and try again.' }
    }
    return { success: false, error: error instanceof Error ? error.message : 'Failed to resend invite.' }
  }
}

export async function getLatestTasterInvite(userId: string) {
  try {
    const [invite] = await db
      .select()
      .from(tasterInvites)
      .where(eq(tasterInvites.userId, userId))
      .orderBy(tasterInvites.createdAt)
      .limit(1)
    return invite ?? null
  } catch (error) {
    if (isMissingInviteTable(error)) return null
    throw error
  }
}

export async function getTasterInviteByToken(rawToken: string) {
  const token = rawToken.trim()
  if (!token) return null

  try {
    const tokenHash = hashInviteToken(token)
    const [invite] = await db
      .select({
        id: tasterInvites.id,
        userId: tasterInvites.userId,
        status: tasterInvites.status,
        expiresAt: tasterInvites.expiresAt,
      })
      .from(tasterInvites)
      .where(eq(tasterInvites.tokenHash, tokenHash))
      .limit(1)

    if (!invite) return null

    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, invite.userId))
      .limit(1)

    if (!user) return null

    return { ...invite, email: user.email, name: user.name }
  } catch (error) {
    if (isMissingInviteTable(error)) return null
    throw error
  }
}

export async function acceptTasterInvite(
  _prev: TasterInviteAcceptState,
  formData: FormData,
): Promise<TasterInviteAcceptState> {
  try {
    const token = (formData.get('token') as string)?.trim()
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!token || !password) {
      return { error: 'A password is required.' }
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
      .from(tasterInvites)
      .where(eq(tasterInvites.tokenHash, tokenHash))
      .limit(1)

    if (!invite) return { error: 'This invite link is invalid.' }
    if (invite.status !== 'pending') {
      return { error: 'This invite has already been used or is no longer active.' }
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await db.update(tasterInvites).set({ status: 'expired' }).where(eq(tasterInvites.id, invite.id))
      return { error: 'This invite has expired. Ask an admin to resend it.' }
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, active: users.active })
      .from(users)
      .where(eq(users.id, invite.userId))
      .limit(1)

    if (!user) return { error: 'The account for this invite no longer exists.' }

    const passwordHash = await bcrypt.hash(password, 12)

    await db
      .update(users)
      .set({ passwordHash, active: true, accountStatus: 'active' })
      .where(eq(users.id, user.id))

    await db
      .update(tasterInvites)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(tasterInvites.id, invite.id))

    await logActivityEvent({
      entityType: 'user',
      entityId: user.id,
      relatedUserId: user.id,
      kind: 'taster_invite_accepted',
      title: 'Taster activated their account',
    })

    revalidatePath('/admin/users')

    return { success: true, email: user.email }
  } catch (error) {
    if (isMissingInviteTable(error)) {
      return { error: 'Taster invites are not enabled yet. Run npm run db:push and try again.' }
    }
    return { error: error instanceof Error ? error.message : 'Unable to activate account.' }
  }
}
