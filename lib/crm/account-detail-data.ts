import { and, desc, eq, inArray, sql } from 'drizzle-orm'
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
  smsMessages,
  tastingReports,
  tastings,
  users,
} from '@/db/schema'
import { signedPhotoUrl } from '@/lib/gcs/photo-url'
import type { AccountMediaItem } from '@/components/crm/AccountMediaGalleryCard'

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
  casesOnHand: string
  bottlesOnHand: string
  updatedByUserId: string | null
  updatedByName: string | null
  updatedByRole: string | null
  updatedAt: Date
}

export type AccountInventoryHistoryEvent = {
  id: string
  kind: string
  title: string
  createdAt: Date
  productId: string | null
  productName: string | null
  deltaCases: number
  deltaBottles: number
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

export type AccountMediaFeedItem = AccountMediaItem

function isMissingTable(error: unknown, tableName: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes(tableName.toLowerCase()) && message.includes('does not exist')
}

function isMissingInventoryColumn(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('account_inventory_on_hand') && message.includes('column')
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function toNumericValue(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
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
  mode: 'admin' | 'staff' | 'sales'
): AccountActivityItem {
  const metadata = toRecord(row.metadata)
  let relatedLabel: string | null = null
  let relatedHref: string | null = null

  if (row.entityType === 'order') {
    relatedLabel = `Order #${row.entityId.slice(-8).toUpperCase()}`
    relatedHref = mode === 'sales' ? null : `/${mode}/orders/${row.entityId}`
  } else if (row.entityType === 'delivery') {
    relatedLabel = `Delivery #${row.entityId.slice(-8).toUpperCase()}`
    relatedHref = mode === 'sales' ? null : `/${mode}/deliveries/${row.entityId}`
  } else if (row.entityType === 'tasting') {
    relatedLabel = refs.tastingNames.get(row.entityId) ?? `Tasting #${row.entityId.slice(-8).toUpperCase()}`
    relatedHref = mode === 'admin' ? `/admin/tastings/${row.entityId}` : null
  } else if (row.entityType === 'invoice') {
    relatedLabel = refs.invoices.get(row.entityId) ?? `Invoice #${row.entityId.slice(-8).toUpperCase()}`
    relatedHref = mode === 'admin' ? `/admin/invoicing/${row.entityId}` : null
  } else if (metadata.contactId) {
    relatedLabel = 'Contact record'
    relatedHref = mode === 'sales' ? `/sales/accounts/${row.entityId}/contacts` : `/${mode}/crm/${row.entityId}/contacts`
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
        casesOnHand: accountInventoryOnHand.casesOnHand,
        bottlesOnHand: accountInventoryOnHand.bottlesOnHand,
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
    if (isMissingInventoryColumn(error)) {
      const legacyRows = await db.execute(sql`
        select
          account_inventory_on_hand.id,
          account_inventory_on_hand.account_id,
          account_inventory_on_hand.product_id,
          account_inventory_on_hand.sku,
          account_inventory_on_hand.product_name,
          account_inventory_on_hand.unit_type,
          account_inventory_on_hand.quantity_on_hand,
          account_inventory_on_hand.updated_by_user_id,
          account_inventory_on_hand.updated_at,
          users.name as updated_by_name,
          users.role as updated_by_role
        from account_inventory_on_hand
        left join users on users.id = account_inventory_on_hand.updated_by_user_id
        where account_inventory_on_hand.account_id = ${accountId}::uuid
        order by account_inventory_on_hand.updated_at desc, account_inventory_on_hand.product_name asc
      `)

      return legacyRows.rows.map((row) => {
        const value = row as Record<string, unknown>
        const updatedAt = value.updated_at
        return {
          id: String(value.id),
          accountId: String(value.account_id),
          productId: String(value.product_id),
          sku: String(value.sku ?? ''),
          productName: String(value.product_name ?? ''),
          unitType: typeof value.unit_type === 'string' ? value.unit_type : null,
          casesOnHand: String(value.quantity_on_hand ?? '0'),
          bottlesOnHand: '0',
          updatedByUserId: typeof value.updated_by_user_id === 'string' ? value.updated_by_user_id : null,
          updatedByName: typeof value.updated_by_name === 'string' ? value.updated_by_name : null,
          updatedByRole: typeof value.updated_by_role === 'string' ? value.updated_by_role : null,
          updatedAt: updatedAt instanceof Date ? updatedAt : new Date(updatedAt ? String(updatedAt) : Date.now()),
        } satisfies AccountInventoryItem
      })
    }

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

export async function getAccountInventoryHistory(accountId: string) {
  try {
    const rows = await db
      .select({
        id: activityEvents.id,
        kind: activityEvents.kind,
        title: activityEvents.title,
        metadata: activityEvents.metadata,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .where(and(
        eq(activityEvents.entityType, 'account'),
        eq(activityEvents.entityId, accountId),
        inArray(activityEvents.kind, [
          'account_inventory_added',
          'account_inventory_updated',
          'account_inventory_removed',
        ]),
      ))
      .orderBy(activityEvents.createdAt)

    return rows.flatMap((row) => {
      const metadata = toRecord(row.metadata)
      const before = toRecord(metadata.before)
      const after = toRecord(metadata.after)
      const productName = typeof metadata.productName === 'string' ? metadata.productName : null
      const productId = typeof metadata.productId === 'string' ? metadata.productId : null

      let deltaCases = 0
      let deltaBottles = 0

      if (row.kind === 'account_inventory_updated') {
        deltaCases = toNumericValue(after.casesOnHand) - toNumericValue(before.casesOnHand)
        deltaBottles = toNumericValue(after.bottlesOnHand) - toNumericValue(before.bottlesOnHand)
      } else if (row.kind === 'account_inventory_added') {
        deltaCases = toNumericValue(metadata.casesOnHand)
        deltaBottles = toNumericValue(metadata.bottlesOnHand)
      } else if (row.kind === 'account_inventory_removed') {
        deltaCases = -toNumericValue(metadata.casesOnHand)
        deltaBottles = -toNumericValue(metadata.bottlesOnHand)
      }

      if (deltaCases === 0 && deltaBottles === 0) {
        return []
      }

      return [{
        id: row.id,
        kind: row.kind,
        title: row.title,
        createdAt: row.createdAt,
        productId,
        productName,
        deltaCases,
        deltaBottles,
      } satisfies AccountInventoryHistoryEvent]
    })
  } catch (error) {
    if (!isMissingTable(error, 'activity_events')) {
      console.error('Failed to load account inventory history:', error)
    }
    return [] as AccountInventoryHistoryEvent[]
  }
}

export async function getAccountActivityFeed(accountId: string, mode: 'admin' | 'staff' | 'sales') {
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

export async function getAccountMediaFeed(accountId: string, accountPhones: string[], mode: 'admin' | 'staff' | 'sales', limit?: number) {
  const items: AccountMediaFeedItem[] = []

  try {
    const deliveryRows = await db
      .select({
        id: deliveryStops.id,
        proofOfDeliveryUrl: deliveryStops.proofOfDeliveryUrl,
        shelfPhotoUrl: deliveryStops.shelfPhotoUrl,
        additionalPhotoUrl: deliveryStops.additionalPhotoUrl,
        additionalPhotoUrl2: deliveryStops.additionalPhotoUrl2,
        additionalPhotoUrl3: deliveryStops.additionalPhotoUrl3,
        additionalPhotoUrl4: deliveryStops.additionalPhotoUrl4,
        additionalPhotoUrl5: deliveryStops.additionalPhotoUrl5,
        completedAt: deliveryStops.completedAt,
        deliveryId: deliveries.id,
      })
      .from(deliveryStops)
      .innerJoin(deliveries, eq(deliveryStops.deliveryId, deliveries.id))
      .where(eq(deliveryStops.customerId, accountId))
      .orderBy(desc(deliveryStops.completedAt), desc(deliveries.createdAt))

    for (const row of deliveryRows) {
      const urls = [
        { key: 'proof', label: 'Proof of delivery', url: row.proofOfDeliveryUrl },
        { key: 'shelf', label: 'Shelf photo', url: row.shelfPhotoUrl },
        { key: 'extra-1', label: 'Additional photo', url: row.additionalPhotoUrl },
        { key: 'extra-2', label: 'Additional photo', url: row.additionalPhotoUrl2 },
        { key: 'extra-3', label: 'Additional photo', url: row.additionalPhotoUrl3 },
        { key: 'extra-4', label: 'Additional photo', url: row.additionalPhotoUrl4 },
        { key: 'extra-5', label: 'Additional photo', url: row.additionalPhotoUrl5 },
      ]

      for (const media of urls) {
        const safeUrl = signedPhotoUrl(media.url)
        if (!safeUrl) continue
        items.push({
          id: `${row.id}-${media.key}`,
          url: safeUrl,
          thumbnailUrl: safeUrl,
          label: media.label,
          sourceType: 'delivery',
          sourceLabel: `Delivery ${String(row.deliveryId).slice(-8).toUpperCase()}`,
          caption: null,
          createdAt: row.completedAt ?? new Date(),
          relatedHref: mode === 'admin' ? `/admin/deliveries/${row.deliveryId}` : null,
        })
      }
    }
  } catch (error) {
    if (!isMissingTable(error, 'delivery_stops')) {
      console.error('Failed to load account delivery media:', error)
    }
  }

  try {
    const tastingRows = await db
      .select({
        tastingId: tastings.id,
        eventName: tastings.eventName,
        submittedAt: tastingReports.submittedAt,
        setupPhotoUrl: tastingReports.setupPhotoUrl,
        shelfPhotoUrls: tastingReports.shelfPhotoUrls,
      })
      .from(tastings)
      .innerJoin(tastingReports, eq(tastingReports.tastingId, tastings.id))
      .where(eq(tastings.customerId, accountId))
      .orderBy(desc(tastingReports.submittedAt))

    for (const row of tastingRows) {
      const setupUrl = signedPhotoUrl(row.setupPhotoUrl)
      if (setupUrl) {
        items.push({
          id: `${row.tastingId}-setup`,
          url: setupUrl,
          thumbnailUrl: setupUrl,
          label: 'Tasting setup',
          sourceType: 'tasting',
          sourceLabel: row.eventName,
          caption: null,
          createdAt: row.submittedAt,
          relatedHref: mode === 'admin' ? `/admin/tastings/${row.tastingId}` : null,
        })
      }

      const shelfPhotos = Array.isArray(row.shelfPhotoUrls) ? row.shelfPhotoUrls : []
      shelfPhotos.forEach((photoUrl, index) => {
        const safeUrl = signedPhotoUrl(photoUrl)
        if (!safeUrl) return
        items.push({
          id: `${row.tastingId}-shelf-${index}`,
          url: safeUrl,
          thumbnailUrl: safeUrl,
          label: `Tasting shelf photo ${index + 1}`,
          sourceType: 'tasting',
          sourceLabel: row.eventName,
          caption: null,
          createdAt: row.submittedAt,
          relatedHref: mode === 'admin' ? `/admin/tastings/${row.tastingId}` : null,
        })
      })
    }
  } catch (error) {
    if (!isMissingTable(error, 'tasting_reports')) {
      console.error('Failed to load account tasting media:', error)
    }
  }

  try {
    if (accountPhones.length > 0) {
      const smsRows = await db
        .select({
          id: smsMessages.id,
          mediaUrls: smsMessages.mediaUrls,
          body: smsMessages.body,
          createdAt: smsMessages.createdAt,
          direction: smsMessages.direction,
        })
        .from(smsMessages)
        .where(inArray(smsMessages.phoneNumber, accountPhones))
        .orderBy(desc(smsMessages.createdAt))

      for (const row of smsRows) {
        const urls = Array.isArray(row.mediaUrls) ? row.mediaUrls : []
        urls.forEach((url, index) => {
          items.push({
            id: `${row.id}-${index}`,
            url,
            thumbnailUrl: url,
            label: row.direction === 'inbound' ? 'Inbound MMS' : 'Outbound MMS',
            sourceType: 'sms',
            sourceLabel: row.direction === 'inbound' ? 'Customer text' : 'Team text',
            caption: row.body || null,
            createdAt: row.createdAt,
            relatedHref: null,
          })
        })
      }
    }
  } catch (error) {
    if (!isMissingTable(error, 'sms_messages')) {
      console.error('Failed to load account SMS media:', error)
    }
  }

  const sorted = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return typeof limit === 'number' ? sorted.slice(0, limit) : sorted
}
