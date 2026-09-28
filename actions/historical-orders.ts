'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { customerAccounts, historicalOrders } from '@/db/schema'
import { requireAdminOrStaff } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'

const SOURCE_OPTIONS = ['imported', 'manual_historical', 'legacy_system'] as const

export async function addHistoricalOrder(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const session = await requireAdminOrStaff()

  const accountId = String(formData.get('accountId') ?? '').trim()
  const orderDateInput = String(formData.get('orderDate') ?? '').trim()
  const productId = String(formData.get('productId') ?? '').trim() || null
  const productNameFreeform = String(formData.get('productNameFreeform') ?? '').trim() || null
  const cases = Number(formData.get('cases') ?? '0') || 0
  const bottles = Number(formData.get('bottles') ?? '0') || 0
  const orderValueRaw = String(formData.get('orderValue') ?? '').trim()
  const orderValue = orderValueRaw ? Number(orderValueRaw) : null
  const notes = String(formData.get('notes') ?? '').trim() || null
  const sourceInput = String(formData.get('source') ?? 'manual_historical')
  const source = (SOURCE_OPTIONS as readonly string[]).includes(sourceInput)
    ? (sourceInput as typeof SOURCE_OPTIONS[number])
    : 'manual_historical'

  if (!accountId) return { error: 'Account is required.' }
  if (!orderDateInput) return { error: 'Historical order date is required.' }

  const orderDate = new Date(orderDateInput)
  if (Number.isNaN(orderDate.getTime())) return { error: 'Enter a valid order date.' }
  if (!productId && !productNameFreeform) return { error: 'Select a product or enter a product name.' }
  if (orderValueRaw && (Number.isNaN(orderValue) || (orderValue ?? 0) < 0)) return { error: 'Enter a valid order value.' }

  const [account] = await db
    .select({ id: customerAccounts.id })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)
  if (!account) return { error: 'Account not found.' }

  const [row] = await db
    .insert(historicalOrders)
    .values({
      accountId,
      orderDate,
      productId,
      productNameFreeform,
      cases: cases.toFixed(2),
      bottles: bottles.toFixed(2),
      orderValue: orderValue == null ? null : orderValue.toFixed(2),
      notes,
      source,
      createdByUserId: session.user.id,
    })
    .returning({ id: historicalOrders.id })

  await logActivityEvent({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: 'historical_order_added',
    title: 'Historical order added',
    body: `Backfilled order dated ${orderDate.toISOString().slice(0, 10)} (${source.replace(/_/g, ' ')}).`,
    metadata: { historicalOrderId: row.id, cases, bottles, orderValue },
  })

  revalidatePath(`/admin/crm/${accountId}`)
  revalidatePath(`/staff/crm/${accountId}`)
  return { success: true }
}

export async function deleteHistoricalOrder(id: string, accountId: string): Promise<{ error?: string; success?: boolean }> {
  const session = await requireAdminOrStaff()

  await db.delete(historicalOrders).where(eq(historicalOrders.id, id))

  await logActivityEvent({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: 'historical_order_removed',
    title: 'Historical order removed',
    metadata: { historicalOrderId: id },
  })

  revalidatePath(`/admin/crm/${accountId}`)
  revalidatePath(`/staff/crm/${accountId}`)
  return { success: true }
}
