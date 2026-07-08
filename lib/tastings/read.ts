import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { tastings, tastingReports, tasterInvoices, users } from '@/db/schema'

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
      assignedUserId: tastings.assignedUserId,
      createdByUserId: tastings.createdByUserId,
      eventName: tastings.eventName,
      scheduledAt: tastings.scheduledAt,
      endAt: tastings.endAt,
      trainingDay: tastings.trainingDay,
      status: tastings.status,
      storeAddress: tastings.storeAddress,
      storeCity: tastings.storeCity,
      storeState: tastings.storeState,
      storeZip: tastings.storeZip,
      storePhone: tastings.storePhone,
      notes: tastings.notes,
      createdAt: tastings.createdAt,
      tasterName: users.name,
      tasterPhone: users.phone,
      reportSubmittedAt: tastingReports.submittedAt,
      invoiceSubmittedAt: tasterInvoices.submittedAt,
      invoiceStatus: tasterInvoices.status,
    })
    .from(tastings)
    .innerJoin(users, eq(tastings.assignedUserId, users.id))
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
        tasterName: users.name,
        tasterPhone: users.phone,
        reportSubmittedAt: tastingReports.submittedAt,
        invoiceSubmittedAt: tasterInvoices.submittedAt,
        invoiceStatus: tasterInvoices.status,
      })
      .from(tastings)
      .innerJoin(users, eq(tastings.assignedUserId, users.id))
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
