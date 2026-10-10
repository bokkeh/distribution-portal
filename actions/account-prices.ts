'use server'

import { and, desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { accountPriceHistory, customerAccounts, orderItems, orders, products, salesMembers, tastingReports, tastings, users } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { priceObservationSchema } from '@/lib/crm/price-validation'
import { parseDateTimeInTimeZone } from '@/lib/tastings/time'

async function requirePriceAccess(accountId: string) {
  const session = await requireRole('admin', 'staff', 'sales_manager', 'sales_rep')
  const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
  if (!account) throw new Error('Account not found.')
  const roles = new Set(session.user.roles ?? [session.user.role])
  if (!['admin', 'staff', 'sales_manager'].some(role => roles.has(role))) {
    const [member] = await db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1)
    if (!member || account.assignedSalesRepId !== member.id) throw new Error('You are not assigned to this account.')
  }
  return session
}

export async function getAccountPriceHistory(accountId: string) {
  await requirePriceAccess(accountId)
  return db.select({
    id: accountPriceHistory.id, productId: accountPriceHistory.productId,
    productName: products.name, price: accountPriceHistory.price,
    observedOn: accountPriceHistory.observedOn, notes: accountPriceHistory.notes,
    observedAt: accountPriceHistory.observedAt, timeZone: accountPriceHistory.timeZone,
    currency: accountPriceHistory.currency, priceType: accountPriceHistory.priceType,
    productSize: accountPriceHistory.productSize, sku: products.sku,
    actorName: users.name,
  }).from(accountPriceHistory)
    .innerJoin(products, eq(accountPriceHistory.productId, products.id))
    .leftJoin(users, eq(accountPriceHistory.createdByUserId, users.id))
    .where(eq(accountPriceHistory.accountId, accountId))
    .orderBy(desc(sql`COALESCE(${accountPriceHistory.observedAt}, ${accountPriceHistory.observedOn}::timestamp AT TIME ZONE ${accountPriceHistory.timeZone})`), desc(accountPriceHistory.createdAt), desc(accountPriceHistory.id))
}

export async function getAccountPriceSales(accountId: string) {
  await requirePriceAccess(accountId)
  const [wholesale, consumer] = await Promise.all([
    db.select({ id: orderItems.id, productId: orderItems.productId, productName: products.name, date: orders.createdAt, quantity: orderItems.quantity, unit: orderItems.unit, total: orderItems.total })
      .from(orders).innerJoin(orderItems, eq(orderItems.orderId, orders.id)).innerJoin(products, eq(products.id, orderItems.productId))
      .where(and(eq(orders.customerId, accountId), eq(orders.orderType, 'paid'), sql`${orders.status} IN ('confirmed', 'fulfilled')`)).orderBy(desc(orders.createdAt)),
    db.select({ id: tastingReports.id, date: tastings.scheduledAt, timeZone: tastings.timeZone, bottlesSold: tastingReports.bottlesSold })
      .from(tastings).innerJoin(tastingReports, eq(tastingReports.tastingId, tastings.id)).where(and(eq(tastings.customerId, accountId), eq(tastings.status, 'completed'))).orderBy(desc(tastings.scheduledAt)),
  ])
  return { wholesale, consumer }
}

function refreshAccount(accountId: string) {
  for (const path of ['admin/crm', 'staff/crm', 'sales/accounts']) revalidatePath(`/${path}/${accountId}`)
}

export async function saveAccountPrice(formData: FormData) {
  const parsed = priceObservationSchema.safeParse(Object.fromEntries(['requestId', 'accountId', 'productId', 'price', 'observedOn', 'observedTime', 'timeZone', 'currency', 'priceType', 'productSize', 'notes'].map(key => [key, String(formData.get(key) ?? '')])))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const input = parsed.data
  const accountId = String(formData.get('accountId') ?? '')
  const session = await requirePriceAccess(accountId)
  const productId = String(formData.get('productId') ?? '')
  const price = String(formData.get('price') ?? '').trim()
  const observedOn = String(formData.get('observedOn') ?? '')
  const parsedDate = new Date(`${observedOn}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== observedOn) return { error: 'Enter a valid observation date.' }
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(price)) return { error: 'Enter a price of zero or more, with up to two decimal places.' }
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
  if (!product) return { error: 'Choose a valid product.' }
  const observedAt = parseDateTimeInTimeZone(observedOn, input.observedTime, input.timeZone)
  const [saved] = await db.insert(accountPriceHistory).values({ id: input.requestId, accountId, productId, price, observedOn, observedAt, timeZone: input.timeZone, currency: input.currency, priceType: input.priceType, productSize: input.productSize || null, notes: input.notes || null, createdByUserId: session.user.id }).onConflictDoNothing({ target: accountPriceHistory.id }).returning({ id: accountPriceHistory.id })
  if (!saved) {
    const [existing] = await db.select().from(accountPriceHistory).where(eq(accountPriceHistory.id, input.requestId)).limit(1)
    if (!existing || existing.accountId !== accountId || existing.productId !== productId || existing.createdByUserId !== session.user.id || Number(existing.price) !== Number(price) || existing.observedAt?.getTime() !== observedAt.getTime() || existing.currency !== input.currency || existing.priceType !== input.priceType || (existing.productSize ?? '') !== input.productSize || (existing.notes ?? '') !== input.notes) return { error: 'This observation request was already used. Start a new observation.' }
  }
  refreshAccount(accountId)
  return { success: true }
}

export async function deleteAccountPrice(accountId: string, entryId: string) {
  await requirePriceAccess(accountId)
  await db.delete(accountPriceHistory).where(and(eq(accountPriceHistory.accountId, accountId), eq(accountPriceHistory.id, entryId)))
  refreshAccount(accountId)
  return { success: true }
}
