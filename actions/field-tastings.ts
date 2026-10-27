'use server'

import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { customerAccounts, tastings, users } from '@/db/schema'
import { fieldContext } from '@/lib/field/access'
import { upcomingTastingFilter } from '@/lib/tastings/upcoming-filter'

const filters = z.object({
  period: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  query: z.string().trim().max(100).default(''),
  offset: z.number().int().min(0).max(100000).default(0),
})

export async function getFieldTastings(input: { period?: 'upcoming' | 'past' | 'all'; query?: string; offset?: number } = {}) {
  const { managesAll, member } = await fieldContext()
  const { period, query, offset } = filters.parse(input)
  const now = new Date()
  const where = and(
    managesAll ? undefined : eq(customerAccounts.assignedSalesRepId, member!.id),
    period === 'upcoming' ? upcomingTastingFilter(now) : period === 'past'
      ? sql`COALESCE(${tastings.endAt}, ${tastings.scheduledAt} + interval '2 hours') <= ${now.toISOString()}::timestamptz` : undefined,
    query ? or(ilike(customerAccounts.companyName, `%${query}%`), ilike(tastings.eventName, `%${query}%`), ilike(users.name, `%${query}%`), ilike(tastings.storeCity, `%${query}%`)) : undefined,
  )
  const [rows, totals] = await Promise.all([
    db.select({ id: tastings.id, accountId: customerAccounts.id, accountName: customerAccounts.companyName,
      eventName: tastings.eventName, start: tastings.scheduledAt, end: tastings.endAt, timeZone: tastings.timeZone,
      status: tastings.status, assignee: users.name, address: tastings.storeAddress, city: tastings.storeCity, state: tastings.storeState,
    }).from(tastings).innerJoin(customerAccounts, eq(tastings.customerId, customerAccounts.id))
      .leftJoin(users, eq(tastings.assignedUserId, users.id)).where(where)
      .orderBy(period === 'upcoming' ? asc(tastings.scheduledAt) : desc(tastings.scheduledAt), asc(tastings.id)).limit(50).offset(offset),
    db.select({ total: count() }).from(tastings).innerJoin(customerAccounts, eq(tastings.customerId, customerAccounts.id))
      .leftJoin(users, eq(tastings.assignedUserId, users.id)).where(where),
  ])
  const total = totals[0]?.total ?? 0
  return {
    rows: rows.map(row => ({ ...row, start: row.start.toISOString(), end: row.end?.toISOString() ?? null, assignee: row.assignee ?? 'Unassigned' })),
    total, nextOffset: offset + rows.length, hasMore: offset + rows.length < total,
  }
}
