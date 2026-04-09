'use server'

import { and, ilike, inArray, or, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/session'
import { db } from '@/db'
import { accountNotes, customerAccounts, users } from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'
import { createUserNotification } from '@/lib/notifications/in-app'

const CRM_MENTION_ROLES = ['admin', 'staff', 'sales_rep', 'sales_manager'] as const

function buildAccountReviewHref(userRoles: string[] | null | undefined, accountId: string) {
  if (userRoles?.includes('sales_rep') || userRoles?.includes('sales_manager')) {
    return `/sales/accounts/${accountId}`
  }

  if (userRoles?.includes('staff')) {
    return `/staff/crm/${accountId}`
  }

  return `/admin/crm/${accountId}`
}

export async function saveCallNote(
  accountId: string,
  phone: string,
  accountName: string,
  notes: string,
  taggedUserIds: string[] = [],
): Promise<void> {
  const session = await requireAuth()
  const trimmedNotes = notes.trim()
  if (!trimmedNotes) return

  const uniqueTaggedUserIds = Array.from(
    new Set(
      taggedUserIds
        .map((value) => value.trim())
        .filter(Boolean)
        .filter((value) => value !== session.user.id),
    ),
  )

  await db.insert(accountNotes).values({
    accountId,
    noteBody: trimmedNotes,
    noteType: 'call_note',
    authorUserId: session.user.id,
    authorRole: session.user.role ?? 'system',
    isPinned: false,
  })

  await logActivityEvent({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: 'call_note',
    title: `Call with ${accountName} (${phone})`,
    body: trimmedNotes,
    metadata: {
      phone,
      taggedUserIds: uniqueTaggedUserIds,
    },
  })

  if (!uniqueTaggedUserIds.length) return

  const taggedUsers = await db
    .select({
      id: users.id,
      name: users.name,
      roles: users.roles,
      active: users.active,
    })
    .from(users)
    .where(and(inArray(users.id, uniqueTaggedUserIds), eq(users.active, true)))

  await Promise.all(
    taggedUsers.map((user) =>
      createUserNotification({
        userId: user.id,
        kind: 'account_note_mention',
        title: `${session.user.name} tagged you in a call note`,
        body: `${accountName}: ${trimmedNotes.length > 140 ? `${trimmedNotes.slice(0, 137)}...` : trimmedNotes}`,
        href: buildAccountReviewHref(user.roles, accountId),
      }),
    ),
  )
}

export async function searchAccountsForCallLink(input: {
  phone?: string
  query?: string
}) {
  await requireAuth()

  const normalizedPhone = (input.phone ?? '').trim()
  const query = (input.query ?? '').trim()

  if (!normalizedPhone && !query) return []

  const clauses = []
  if (normalizedPhone) {
    clauses.push(
      or(
        eq(customerAccounts.phone, normalizedPhone),
        eq(customerAccounts.businessPhone, normalizedPhone),
        eq(customerAccounts.pocPhone, normalizedPhone),
      ),
    )
  }
  if (query) {
    clauses.push(ilike(customerAccounts.companyName, `%${query}%`))
  }

  const whereClause = clauses.length === 1 ? clauses[0] : or(...clauses)
  if (!whereClause) return []

  return db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      phone: customerAccounts.phone,
      businessPhone: customerAccounts.businessPhone,
      pocPhone: customerAccounts.pocPhone,
      city: customerAccounts.city,
      state: customerAccounts.state,
    })
    .from(customerAccounts)
    .where(whereClause)
    .limit(8)
}

export async function searchInternalUsersForCallTag(query: string) {
  await requireAuth()

  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []

  const matchedUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      roles: users.roles,
      active: users.active,
    })
    .from(users)
    .where(
      and(
        eq(users.active, true),
        or(
          ilike(users.name, `%${trimmedQuery}%`),
          ilike(users.email, `%${trimmedQuery}%`),
        ),
      ),
    )
    .limit(10)

  return matchedUsers
    .filter((user) => CRM_MENTION_ROLES.some((role) => user.roles.includes(role)))
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }))
}
