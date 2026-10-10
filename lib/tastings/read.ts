import { desc, eq, sql } from 'drizzle-orm'
import { isUpcomingTasting } from './scheduling'
import { db } from '@/db'
import { customerAccounts, tastings, tastingReports, tasterInvoices, users } from '@/db/schema'

function isMissingTastingColumn(error: unknown) {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code
    ?? (error as { cause?: { code?: string } } | null)?.cause?.code
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return code === '42703'
    || message.includes('end_at')
    || message.includes('checked_in_at')
    || message.includes('training_day')
}

function coerceDateOrNull(value: Date | string | null | undefined) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function sanitizeTastingRecord<T extends {
  id: string
  scheduledAt: Date | string | null
  endAt?: Date | string | null
  checkedInAt?: Date | string | null
  reportSubmittedAt?: Date | string | null
  invoiceSubmittedAt?: Date | string | null
  createdAt?: Date | string | null
}>(row: T): (T & {
  scheduledAt: Date
  endAt: Date | null
  checkedInAt?: Date | null
  reportSubmittedAt?: Date | null
  invoiceSubmittedAt?: Date | null
  createdAt?: Date | null
}) | null {
  const scheduledAt = coerceDateOrNull(row.scheduledAt)
  if (!scheduledAt) {
    console.error('[tastings] Skipping tasting with invalid scheduledAt:', row.id, row.scheduledAt)
    return null
  }

  return {
    ...row,
    scheduledAt,
    endAt: 'endAt' in row ? coerceDateOrNull(row.endAt ?? null) : null,
    ...(Object.prototype.hasOwnProperty.call(row, 'checkedInAt') ? { checkedInAt: coerceDateOrNull(row.checkedInAt ?? null) } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'reportSubmittedAt') ? { reportSubmittedAt: coerceDateOrNull(row.reportSubmittedAt ?? null) } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'invoiceSubmittedAt') ? { invoiceSubmittedAt: coerceDateOrNull(row.invoiceSubmittedAt ?? null) } : {}),
    ...(Object.prototype.hasOwnProperty.call(row, 'createdAt') ? { createdAt: coerceDateOrNull(row.createdAt ?? null) } : {}),
  }
}

export async function getTastingById(tastingId: string) {
  try {
    const [tasting] = await db.select().from(tastings).where(eq(tastings.id, tastingId)).limit(1)
    return tasting ? sanitizeTastingRecord(tasting) : null
  } catch (error) {
    if (!isMissingTastingColumn(error)) throw error

    const [tasting] = await db
      .select({
        id: tastings.id,
        customerId: tastings.customerId,
        assignedUserId: tastings.assignedUserId,
        createdByUserId: tastings.createdByUserId,
        eventName: tastings.eventName,
        scheduledAt: tastings.scheduledAt,
        status: tastings.status,
        storeAddress: tastings.storeAddress,
        storeCity: tastings.storeCity,
        storeState: tastings.storeState,
        storeZip: tastings.storeZip,
        storePhone: tastings.storePhone,
        notes: tastings.notes,
        cancellationReason: tastings.cancellationReason,
        cancellationNote: tastings.cancellationNote,
        createdAt: tastings.createdAt,
      })
      .from(tastings)
      .where(eq(tastings.id, tastingId))
      .limit(1)

    return tasting ? sanitizeTastingRecord({ ...tasting, endAt: null, checkedInAt: null, trainingDay: false }) : null
  }
}

export async function getTastingsForViewWithFallback({ assignedUserId }: { assignedUserId?: string }) {
  const buildBaseQuery = () => db
    .select({
      id: tastings.id,
      customerId: tastings.customerId,
      accountName: customerAccounts.companyName,
      assignedUserId: tastings.assignedUserId,
      createdByUserId: tastings.createdByUserId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      endAt: tastings.endAt,
      timeZone: tastings.timeZone,
      trainingDay: tastings.trainingDay,
      status: tastings.status,
      storeAddress: tastings.storeAddress,
      storeCity: tastings.storeCity,
      storeState: tastings.storeState,
      storeZip: tastings.storeZip,
      storePhone: tastings.storePhone,
      notes: tastings.notes,
      cancellationReason: tastings.cancellationReason,
      createdAt: tastings.createdAt,
      tasterName: sql<string>`COALESCE(${users.name}, 'Unassigned')`,
      tasterPhone: users.phone,
      reportSubmittedAt: tastingReports.submittedAt,
      reportBottlesSold: tastingReports.bottlesSold,
      reportSamplesServed: tastingReports.samplesServed,
      invoiceSubmittedAt: tasterInvoices.submittedAt,
      invoiceStatus: tasterInvoices.status,
    })
    .from(tastings)
    .leftJoin(customerAccounts, eq(tastings.customerId, customerAccounts.id))
    .leftJoin(users, eq(tastings.assignedUserId, users.id))
    .leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
    .leftJoin(tasterInvoices, eq(tasterInvoices.tastingId, tastings.id))

  try {
    const base = buildBaseQuery()
    const rows = assignedUserId
      ? await base.where(eq(tastings.assignedUserId, assignedUserId)).orderBy(desc(tastings.scheduledAt))
      : await base.orderBy(desc(tastings.scheduledAt))
    const sanitizedRows = rows
      .map((row) => sanitizeTastingRecord(row))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
    return assignedUserId ? sanitizedRows.filter((row) => row.status !== 'requested') : sanitizedRows
  } catch (error) {
    if (!isMissingTastingColumn(error)) throw error

    const base = db
      .select({
        id: tastings.id,
        customerId: tastings.customerId,
        accountName: customerAccounts.companyName,
        assignedUserId: tastings.assignedUserId,
        createdByUserId: tastings.createdByUserId,
        eventName: tastings.eventName,
        scheduledAt: tastings.scheduledAt,
        status: tastings.status,
        storeAddress: tastings.storeAddress,
        storeCity: tastings.storeCity,
        storeState: tastings.storeState,
        storeZip: tastings.storeZip,
        storePhone: tastings.storePhone,
        notes: tastings.notes,
        createdAt: tastings.createdAt,
        tasterName: sql<string>`COALESCE(${users.name}, 'Unassigned')`,
        tasterPhone: users.phone,
        reportSubmittedAt: tastingReports.submittedAt,
        reportBottlesSold: tastingReports.bottlesSold,
        reportSamplesServed: tastingReports.samplesServed,
        invoiceSubmittedAt: tasterInvoices.submittedAt,
        invoiceStatus: tasterInvoices.status,
      })
      .from(tastings)
      .leftJoin(customerAccounts, eq(tastings.customerId, customerAccounts.id))
      .leftJoin(users, eq(tastings.assignedUserId, users.id))
      .leftJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
      .leftJoin(tasterInvoices, eq(tasterInvoices.tastingId, tastings.id))

    const rows = assignedUserId
      ? await base.where(eq(tastings.assignedUserId, assignedUserId)).orderBy(desc(tastings.scheduledAt))
      : await base.orderBy(desc(tastings.scheduledAt))

    const hydratedRows = rows
      .map(row => sanitizeTastingRecord({ ...row, endAt: null, trainingDay: false }))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
    return assignedUserId ? hydratedRows.filter((row) => row.status !== 'requested') : hydratedRows
  }
}

export type AccountTastingSummary = {
  nextTasting: { id: string; scheduledAt: Date; timeZone: string; status: string } | null
  associatedTaster: { userId: string; name: string; tastingId: string; scheduledAt: Date; timeZone: string; status: string } | null
}

/**
 * "Next Tasting" and "Associated Taster" for a CRM account overview, derived from tasting
 * records rather than a stored relationship (no permanent taster<->account link exists).
 */
export async function getAccountTastingSummary(accountId: string): Promise<AccountTastingSummary> {
  const rows = await db
    .select({
      id: tastings.id,
      status: tastings.status,
      endAt: tastings.endAt,
      timeZone: tastings.timeZone,
      scheduledAt: tastings.scheduledAt,
      assignedUserId: tastings.assignedUserId,
      tasterName: sql<string>`COALESCE(${users.name}, 'Unassigned')`,
    })
    .from(tastings)
    .leftJoin(users, eq(tastings.assignedUserId, users.id))
    .where(eq(tastings.customerId, accountId))
    .orderBy(desc(tastings.scheduledAt))

  const now = Date.now()

  const upcoming = rows
    .filter((row) => isUpcomingTasting(row, now))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0] ?? null

  const mostRecentPast = rows.find(
    (row) => row.scheduledAt.getTime() < now && !['cancelled', 'declined', 'requested'].includes(row.status),
  ) ?? null

  const relevant = upcoming ?? mostRecentPast

  return {
    nextTasting: upcoming ? { id: upcoming.id, scheduledAt: upcoming.scheduledAt, timeZone: upcoming.timeZone, status: upcoming.status } : null,
    associatedTaster: relevant?.assignedUserId
      ? {
          userId: relevant.assignedUserId,
          name: relevant.tasterName,
          tastingId: relevant.id,
          scheduledAt: relevant.scheduledAt,
          timeZone: relevant.timeZone,
          status: relevant.status,
        }
      : null,
  }
}
