'use server'

import { or, ilike, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth/session'
import { db } from '@/db'
import { activityEvents, customerAccounts } from '@/db/schema'

export async function saveCallNote(
  accountId: string,
  phone: string,
  accountName: string,
  notes: string,
): Promise<void> {
  const session = await requireAuth()
  if (!notes.trim()) return

  await db.insert(activityEvents).values({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: 'call_note',
    title: `Call with ${accountName} (${phone})`,
    body: notes.trim(),
    metadata: { phone },
  })
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
