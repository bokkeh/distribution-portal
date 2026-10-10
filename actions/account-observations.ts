'use server'

import { upsertAccountInventoryItem } from '@/actions/crm-account'
import { saveAccountPrice } from '@/actions/account-prices'
import { parseObservationSelection, priceObservationSchema } from '@/lib/crm/price-validation'
import { db } from '@/db'
import { customerAccounts, salesMembers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth/session'

/** Blank count means no inventory observation, including when a price is supplied. */
export async function saveAccountObservations(data: FormData) {
  const selection = parseObservationSelection(String(data.get('bottlesOnHand') ?? ''), String(data.get('price') ?? ''))
  if ('error' in selection) return { error: selection.error, inventorySaved: false, priceSaved: false }
  if (selection.pricing) {
    const parsed = priceObservationSchema.safeParse(Object.fromEntries(['requestId', 'accountId', 'productId', 'price', 'observedOn', 'observedTime', 'timeZone', 'currency', 'priceType', 'productSize', 'notes'].map(key => [key, String(data.get(key) ?? '')])))
    if (!parsed.success) return { error: parsed.error.issues[0].message, inventorySaved: false, priceSaved: false }
  }
  let inventorySaved = false
  let priceSaved = false
  try {
    const session = await requireRole('admin', 'staff', 'sales_rep', 'sales_manager')
    if (!session.user.roles.some(role => ['admin', 'staff', 'sales_manager'].includes(role))) {
      const [member] = await db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1)
      const [account] = await db.select({ assignedSalesRepId: customerAccounts.assignedSalesRepId }).from(customerAccounts).where(eq(customerAccounts.id, String(data.get('accountId') ?? ''))).limit(1)
      if (!member || account?.assignedSalesRepId !== member.id) return { error: 'You are not assigned to this account.', inventorySaved, priceSaved }
    }
    // Price first: its request id makes retry after an uncertain response safe.
    if (selection.pricing) {
      const result = await saveAccountPrice(data)
      if (result.error) return { error: result.error, inventorySaved, priceSaved }
      priceSaved = true
    }
    if (selection.inventory) {
      data.set('inventoryDate', String(data.get('observedOn') ?? ''))
      const result = await upsertAccountInventoryItem(data)
      if (result.error) return { error: priceSaved ? `Price saved. Inventory failed: ${result.error}. Retry inventory only.` : result.error, inventorySaved, priceSaved }
      inventorySaved = true
    }
    return { success: true as const, inventorySaved, priceSaved }
  } catch {
    return { error: priceSaved ? 'Price saved. Could not confirm inventory; reload its history before retrying inventory only.' : 'Could not confirm save. Your details are kept; check your connection and retry.', inventorySaved, priceSaved }
  }
}
