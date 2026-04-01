import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  accountInventoryOnHand,
  accountNotes,
  activityEvents,
  customerAccounts,
  deliveries,
  deliveryStops,
  invoices,
  orders,
  products,
  tastings,
  users,
} from '@/db/schema'

export type AccountNoteItem = {
  id: string
  accountId: string
  noteBody: string
  noteType: string
  authorUserId: string | null
  authorName: string | null
  authorRole: string | null
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
}

export type AccountInventoryItem = {
  id: string
  accountId: string
  productId: string
  sku: string
  productName: string
  unitType: string | null
  quantityOnHand: string
  updatedByUserId: string | null
  updatedByName: string | null
  updatedByRole: string | null
  updatedAt: Date
}

export type AccountActivityItem = {
  id: string
  category: string
  eventType: string
  title: string
  description: string | null
  createdAt: Date
  actorName: string | null
  actorRole: string | null
  sourceLabel: string
  relatedLabel: string | null
  relatedHref: string | null
  metadata: Record<string, unknown>
}

function isMissingTable(error: unknown, tableName: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes(tableName.toLowerCase()) && message.includes('does not exist')
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function categorizeActivity(entityType: string, kind: string) {
  const normalizedKind = kind.toLowerCase()

  if (normalizedKind.includes('note')) return 'notes'
  if (normalizedKind.includes('inventory')) return 'inventory'
  if (normalizedKind.includes('call')) return 'calls'
  if (normalizedKind.includes('email')) return 'emails'
  if (normalizedKind.includes('sms') || normalizedKind.includes('text')) return 'sms'
  if (entityType === 'order') return 'orders'
  if (entityType === 'delivery') return 'deliveries'
  if (entityType === 'tasting') return 'tastings'
  if (normalizedKind.includes('account') || normalizedKind.includes('contact') || normalizedKind.includes('payment') || normalizedKind.includes('credit') || normalizedKind.includes('preference')) {
    return 'profile_updates'
  }
  return 'system'
}

type RawActivityEvent = {
  id: string
  entityType: string
  entityId: string
  kind: string
  title: string
  body: string | null
  metadata: unknown
  createdAt: Date
  actorName: string | null
  actorRole: string | null
}

function mapActivityEvent(
  row: RawActivityEvent,
  refs: {
    invoices: Map<string, string>
    tastingNames: Map<string, string>
  },
  mode: 'admin' | 'staff'
): AccountActivityItem {
  const metadata = toRecord(row.metadata)
  let relatedLabel: string | null = null
  let relatedHref: string | null = null

  if (row.entityType === 'order') {
    relatedLabel = `Order #${row.entityId.slice(-8).toUpperCase()}`
    relatedHref = `/${mode}/orders/${row.entityId}`
  } else if (row.entityType === 'delivery') {
    relatedLabel = `Delivery #${row.entityId.slice(-8).toUpperCase()}`
    relatedHref = `/${mode}/deliveries/${row.entityId}`
  } else if (row.entityType === 'tasting') {
    relatedLabel = refs.tastingNames.get(row.entityId) ?? `Tasting #${row.entityId.slice(-8).toUpperCase()}`
    relatedHref = mode === 'admin' ? `/admin/tastings/${row.entityId}` : null
  } else if (row.entityType === 'invoice') {
    relatedLabel = refs.invoices.get(row.entityId) ?? `Invoice #${row.entityId.slice(-8).toUpperCase()}`
    relatedHref = mode === 'admin' ? `/admin/invoicing/${row.entityId}` : null
  } else if (metadata.contactId) {
    relatedLabel = 'Contact record'
    relatedHref = `/${mode}/crm/${row.entityId}/contacts`
  }

  return {
    id: row.id,
    category: categorizeActivity(row.entityType, row.kind),
    eventType: row.kind,
    title: row.title,
    description: row.body,
    createdAt: row.createdAt,
    actorName: row.actorName,
    actorRole: row.actorRole,
    sourceLabel: row.actorName ? 'User' : 'System',
    relatedLabel,
    relatedHref,
    metadata,
  }
}

async function getActivityRows(entityType: 'account' | 'order' | 'delivery' | 'tasting' | 'invoice', entityIds: string[]) {
  if (entityIds.length === 0) return [] as RawActivityEvent[]

  return db
    .select({
      id: activityEvents.id,
      entityType: activityEvents.entityType,
      entityId: activityEvents.entityId,
      kind: activityEvents.kind,
      title: activityEvents.title,
      body: activityEvents.body,
      metadata: activityEvents.metadata,
      createdAt: activityEvents.createdAt,
      actorName: users.name,
      actorRole: users.role,
    })
    .from(activityEvents)
    .leftJoin(users, eq(activityEvents.actorUserId, users.id))
    .where(and(eq(activityEvents.entityType, entityType), inArray(activityEvents.entityId, entityIds)))
    .orderBy(desc(activityEvents.createdAt))
}

export async function getAccountNotes(accountId: string) {
  try {
    return await db
      .select({
        id: accountNotes.id,
        accountId: accountNotes.accountId,
        noteBody: accountNotes.noteBody,
        noteType: accountNotes.noteType,
        authorUserId: accountNotes.authorUserId,
        authorName: users.name,
        authorRole: accountNotes.authorRole,
        isPinned: accountNotes.isPinned,
        createdAt: accountNotes.createdAt,
        updatedAt: accountNotes.updatedAt,
      })
      .from(accountNotes)
      .leftJoin(users, eq(accountNotes.authorUserId, users.id))
      .where(eq(accountNotes.accountId, accountId))
      .orderBy(desc(accountNotes.isPinned), desc(accountNotes.createdAt))
  } catch (error) {
    if (!isMissingTable(error, 'account_notes')) {
      console.error('Failed to load account notes:', error)
    }
    return [] as AccountNoteItem[]
  }
}

export async function getAccountInventoryOnHand(accountId: string) {
  try {
    return await db
      .select({
        id: accountInventoryOnHand.id,
        accountId: accountInventoryOnHand.accountId,
        productId: accountInventoryOnHand.productId,
        sku: accountInventoryOnHand.sku,
        productName: accountInventoryOnHand.productName,
        unitType: accountInventoryOnHand.unitType,
        quantityOnHand: accountInventoryOnHand.quantityOnHand,
        updatedByUserId: accountInventoryOnHand.updatedByUserId,
        updatedByName: users.name,
        updatedByRole: users.role,
        updatedAt: accountInventoryOnHand.updatedAt,
      })
      .from(accountInventoryOnHand)
      .leftJoin(users, eq(accountInventoryOnHand.updatedByUserId, users.id))
      .where(eq(accountInventoryOnHand.accountId, accountId))
      .orderBy(desc(accountInventoryOnHand.updatedAt), accountInventoryOnHand.productName)
  } catch (error) {
    if (!isMissingTable(error, 'account_inventory_on_hand')) {
      console.error('Failed to load account inventory on hand:', error)
    }
    return [] as AccountInventoryItem[]
  }
}

export async function getAvailableInventoryProducts() {
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      unit: products.unit,
      active: products.active,
    })
    .from(products)
    .orderBy(desc(products.active), products.name)
}

export async function getAccountActivityFeed(accountId: string, mode: 'admin' | 'staff') {
  try {
    const [invoiceRefs, tastingRefs, orderRefs, deliveryRefs] = await Promise.all([
      db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber }).from(invoices).where(eq(invoices.customerId, accountId)),
      db.select({ id: tastings.id, eventName: tastings.eventName }).from(tastings).where(eq(tastings.customerId, accountId)),
      db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, accountId)),
      db
        .select({ id: deliveries.id })
        .from(deliveryStops)
        .innerJoin(deliveries, eq(deliveryStops.deliveryId, deliveries.id))
        .where(eq(deliveryStops.customerId, accountId)),
    ])

    const orderIds = orderRefs.map((row) => row.id)
    const invoiceIds = invoiceRefs.map((row) => row.id)
    const tastingIds = tastingRefs.map((row) => row.id)
    const deliveryIds = Array.from(new Set(deliveryRefs.map((row) => row.id)))

    const [accountRows, orderRows, deliveryRows, tastingRows, invoiceRows] = await Promise.all([
      getActivityRows('account', [accountId]),
      getActivityRows('order', orderIds),
      getActivityRows('delivery', deliveryIds),
      getActivityRows('tasting', tastingIds),
      getActivityRows('invoice', invoiceIds),
    ])

    const refs = {
      invoices: new Map(invoiceRefs.map((row) => [row.id, row.invoiceNumber])),
      tastingNames: new Map(tastingRefs.map((row) => [row.id, row.eventName])),
    }

    return [...accountRows, ...orderRows, ...deliveryRows, ...tastingRows, ...invoiceRows]
      .map((row) => mapActivityEvent(row, refs, mode))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch (error) {
    if (!isMissingTable(error, 'activity_events')) {
      console.error('Failed to load account activity feed:', error)
    }
    const [account] = await db
      .select({ id: customerAccounts.id, companyName: customerAccounts.companyName, createdAt: customerAccounts.createdAt })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, accountId))
      .limit(1)

    if (!account) return [] as AccountActivityItem[]

    return [{
      id: `account-created-${account.id}`,
      category: 'system',
      eventType: 'account_created',
      title: 'Account created',
      description: `${account.companyName} was added to the CRM.`,
      createdAt: account.createdAt,
      actorName: null,
      actorRole: null,
      sourceLabel: 'System',
      relatedLabel: null,
      relatedHref: null,
      metadata: {},
    }]
  }
}
