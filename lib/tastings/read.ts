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

export async function getTastingById(tastingId: string) {
  try {
    const [tasting] = await db.select().from(tastings).where(eq(tastings.id, tastingId)).limit(1)
    return tasting ?? null
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
        trainingDay: tastings.trainingDay,
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

    return tasting ? { ...tasting, endAt: null, checkedInAt: null, trainingDay: false } : null
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
    return assignedUserId ? rows.filter((row) => row.status !== 'requested') : rows
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

    const rows = assignedUserId
      ? await base.where(eq(tastings.assignedUserId, assignedUserId)).orderBy(desc(tastings.scheduledAt))
      : await base.orderBy(desc(tastings.scheduledAt))

    const hydratedRows = rows.map(row => ({ ...row, endAt: null, trainingDay: false }))
    return assignedUserId ? hydratedRows.filter((row) => row.status !== 'requested') : hydratedRows
  }
}
