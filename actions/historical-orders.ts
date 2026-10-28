'use server'
import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { createHash } from 'node:crypto'
import { db } from '@/db'
import { historicalOrders } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { historicalInput, historicalFingerprintParts } from '@/lib/orders/historical'

export async function addHistoricalOrder(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const session = await requireAdminOrStaff()
  const parsed = historicalInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues.map(i => i.message).join(' ') }
  const v = parsed.data
  const fingerprint = createHash('sha256').update(historicalFingerprintParts(v)).digest('hex')
  try {
    const possible = await db.execute(sql`SELECT id FROM historical_orders
      WHERE account_id = ${v.accountId}::uuid AND (order_date AT TIME ZONE 'UTC')::date = ${v.orderDate}::date
      AND id IS DISTINCT FROM ${v.id || null}::uuid
      AND (${v.productId || null}::uuid IS NOT NULL AND product_id = ${v.productId || null}::uuid OR lower(trim(product_name_freeform)) = ${v.productNameFreeform.toLowerCase() || null})
      UNION ALL SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id
      WHERE o.customer_id = ${v.accountId}::uuid AND (o.created_at AT TIME ZONE 'America/New_York')::date = ${v.orderDate}::date
      AND o.status <> 'cancelled' AND i.product_id = ${v.productId || null}::uuid LIMIT 1`)
    if (possible.rows.length && !v.duplicateReason) return { error: 'Possible duplicate purchase on this date. Review existing live/imported history; enter a duplicate review reason only if this is a separate purchase.' }
    const data = { accountId: v.accountId, orderDate: new Date(`${v.orderDate}T12:00:00Z`), productId: v.productId || null, productNameFreeform: v.productNameFreeform || null,
      cases: v.cases.toFixed(2), bottles: v.bottles.toFixed(2), orderValue: v.orderValue?.toFixed(2) ?? null,
      caseUnitPrice: v.caseUnitPrice?.toFixed(2) ?? null, bottleUnitPrice: v.bottleUnitPrice?.toFixed(2) ?? null,
      externalReference: v.externalReference || null, paymentStatus: v.paymentStatus || null, fulfillmentStatus: v.fulfillmentStatus || null,
      duplicateReviewReason: v.duplicateReason || null, notes: v.notes || null, source: v.source, fingerprint }
    let row
    if (v.id) {
      ;[row] = await db.update(historicalOrders).set({ ...data, revision: sql`${historicalOrders.revision} + 1` }).where(and(eq(historicalOrders.id, v.id), eq(historicalOrders.accountId, v.accountId), eq(historicalOrders.revision, v.revision))).returning()
      if (!row) return { error: 'Historical purchase changed elsewhere. Reload and review.' }
    } else {
      ;[row] = await db.insert(historicalOrders).values({ ...data, createdByUserId: session.user.id }).onConflictDoNothing().returning()
      if (!row) return { error: 'This exact purchase is already recorded. Review history before adding another.' }
    }
    await logActivityEvent({ entityType: 'account', entityId: v.accountId, actorUserId: session.user.id, kind: v.id ? 'historical_order_corrected' : 'historical_order_added', title: v.id ? 'Historical order corrected' : 'Historical order added', metadata: { ...v, historicalOrderId: row.id } })
    for (const path of [`/admin/crm/${v.accountId}`, `/staff/crm/${v.accountId}`, `/sales/accounts/${v.accountId}`, '/admin/pull-through', '/sales/accounts']) revalidatePath(path)
    return { success: true }
  } catch { return { error: 'Could not save historical order. Check references and duplicate purchases.' } }
}

export async function deleteHistoricalOrder(id: string, accountId: string): Promise<{ error?: string; success?: boolean }> {
  const session = await requireAdminOrStaff()
  // Keep provenance and purchase details: voiding is reversible in the correction form.
  const [row] = await db.update(historicalOrders).set({ fulfillmentStatus: 'cancelled', revision: sql`${historicalOrders.revision} + 1` }).where(and(eq(historicalOrders.id, id), eq(historicalOrders.accountId, accountId))).returning()
  if (!row) return { error: 'Historical order not found.' }
  await logActivityEvent({ entityType: 'account', entityId: accountId, actorUserId: session.user.id, kind: 'historical_order_voided', title: 'Historical order voided', metadata: { historicalOrderId: id } })
  for (const mode of ['admin', 'staff']) revalidatePath(`/${mode}/crm/${accountId}`)
  revalidatePath('/admin/pull-through')
  return { success: true }
}
