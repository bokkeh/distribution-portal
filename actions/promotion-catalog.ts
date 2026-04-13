'use server'

import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  customerAccounts,
  promotionCatalogAccountAvailability,
  promotionCatalogItems,
  promotionCatalogOrderEvents,
  promotionCatalogOrders,
  salesMembers,
  users,
} from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { createNotificationsForRoles, createUserNotification } from '@/lib/notifications/in-app'

type PromotionCategory =
  | 'social_post'
  | 'in_store_signage'
  | 'menu_feature'
  | 'bar_sign'
  | 'restaurant_signage'
  | 'window_cling'
  | 'shelf_talker'
  | 'barker_card'
  | 'other'

type PromotionOrderStatus =
  | 'requested'
  | 'approved'
  | 'in_production'
  | 'ready_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'

function isPromotionCatalogMissingTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes('promotion_catalog')
}

async function getSalesMemberForUser(userId: string) {
  const [member] = await db
    .select({ id: salesMembers.id })
    .from(salesMembers)
    .where(eq(salesMembers.userId, userId))
    .limit(1)
  return member ?? null
}

async function getCustomerAccountForUser(userId: string) {
  const [account] = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
      userId: customerAccounts.userId,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.userId, userId))
    .limit(1)
  return account ?? null
}

async function ensureRepCanManageAccount(userId: string, accountId: string) {
  const member = await getSalesMemberForUser(userId)
  if (!member) throw new Error('Sales rep profile not found.')

  const [account] = await db
    .select({ assignedSalesRepId: customerAccounts.assignedSalesRepId })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account || account.assignedSalesRepId !== member.id) {
    throw new Error('You can only manage promotion catalog access for your assigned accounts.')
  }

  return member
}

async function logPromotionOrderEvent(input: {
  orderId: string
  actorUserId?: string | null
  kind: string
  title: string
  body?: string | null
}) {
  await db.insert(promotionCatalogOrderEvents).values({
    orderId: input.orderId,
    actorUserId: input.actorUserId ?? null,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
  })
}

function statusTitle(status: PromotionOrderStatus) {
  switch (status) {
    case 'requested':
      return 'Promotion request submitted'
    case 'approved':
      return 'Promotion request approved'
    case 'in_production':
      return 'Promotion item in production'
    case 'ready_for_delivery':
      return 'Promotion item ready for delivery'
    case 'delivered':
      return 'Promotion item delivered'
    case 'completed':
      return 'Promotion request completed'
    case 'cancelled':
      return 'Promotion request cancelled'
  }
}

function parseCurrencyInput(value: FormDataEntryValue | null) {
  const numericValue = Number.parseFloat(String(value ?? '0'))
  if (Number.isNaN(numericValue) || numericValue < 0) return '0.00'
  return numericValue.toFixed(2)
}

function parseQuantity(value: FormDataEntryValue | null) {
  const quantity = Number.parseInt(String(value ?? '1'), 10)
  if (!Number.isFinite(quantity) || quantity < 1) return 1
  return quantity
}

function revalidatePromotionPaths() {
  revalidatePath('/admin/sales/promotion-catalog')
  revalidatePath('/sales/promotion-catalog')
  revalidatePath('/customer/promotion-catalog')
}

export async function getPromotionCatalogAdminData() {
  await requireRole('admin', 'sales_manager')

  try {
    const [items, accounts, orders] = await Promise.all([
      db
        .select({
          id: promotionCatalogItems.id,
          title: promotionCatalogItems.title,
          description: promotionCatalogItems.description,
          category: promotionCatalogItems.category,
          imageUrl: promotionCatalogItems.imageUrl,
          price: promotionCatalogItems.price,
          isActive: promotionCatalogItems.isActive,
          isCustomizable: promotionCatalogItems.isCustomizable,
          leadTimeDays: promotionCatalogItems.leadTimeDays,
          fulfillmentType: promotionCatalogItems.fulfillmentType,
          createdAt: promotionCatalogItems.createdAt,
        })
        .from(promotionCatalogItems)
        .orderBy(desc(promotionCatalogItems.createdAt)),
      db
        .select({
          id: customerAccounts.id,
          companyName: customerAccounts.companyName,
          city: customerAccounts.city,
          state: customerAccounts.state,
        })
        .from(customerAccounts)
        .orderBy(asc(customerAccounts.companyName)),
      db
        .select({
          id: promotionCatalogOrders.id,
          status: promotionCatalogOrders.status,
          quantity: promotionCatalogOrders.quantity,
          totalPrice: promotionCatalogOrders.totalPrice,
          requestedAt: promotionCatalogOrders.requestedAt,
          deliveredAt: promotionCatalogOrders.deliveredAt,
          accountId: customerAccounts.id,
          accountName: customerAccounts.companyName,
          itemTitle: promotionCatalogItems.title,
          repName: users.name,
        })
        .from(promotionCatalogOrders)
        .innerJoin(customerAccounts, eq(promotionCatalogOrders.accountId, customerAccounts.id))
        .innerJoin(promotionCatalogItems, eq(promotionCatalogOrders.catalogItemId, promotionCatalogItems.id))
        .leftJoin(users, eq(promotionCatalogOrders.assignedSalesRepUserId, users.id))
        .orderBy(desc(promotionCatalogOrders.requestedAt)),
    ])

    const publicationCounts = await db
      .select({
        catalogItemId: promotionCatalogAccountAvailability.catalogItemId,
        count: sql<number>`count(*)`,
      })
      .from(promotionCatalogAccountAvailability)
      .groupBy(promotionCatalogAccountAvailability.catalogItemId)

    const publicationMap = Object.fromEntries(publicationCounts.map((row) => [row.catalogItemId, Number(row.count)]))

    return {
      items: items.map((item) => ({ ...item, publicationCount: publicationMap[item.id] ?? 0 })),
      accounts,
      orders,
    }
  } catch (error) {
    if (isPromotionCatalogMissingTable(error)) {
      return { items: [], accounts: [], orders: [], missingTable: true as const }
    }
    throw error
  }
}

export async function getPromotionCatalogSalesData() {
  const session = await requireRole('sales_rep', 'sales_manager', 'admin')
  const roles = session.user.roles ?? [session.user.role]
  const canManageAny = roles.includes('admin') || roles.includes('sales_manager')

  try {
    const member = canManageAny ? null : await getSalesMemberForUser(session.user.id)
    const accounts = canManageAny
      ? await db
        .select({
          id: customerAccounts.id,
          companyName: customerAccounts.companyName,
          city: customerAccounts.city,
          state: customerAccounts.state,
        })
        .from(customerAccounts)
        .orderBy(asc(customerAccounts.companyName))
      : member
        ? await db
          .select({
            id: customerAccounts.id,
            companyName: customerAccounts.companyName,
            city: customerAccounts.city,
            state: customerAccounts.state,
          })
          .from(customerAccounts)
          .where(eq(customerAccounts.assignedSalesRepId, member.id))
          .orderBy(asc(customerAccounts.companyName))
        : []

    const orders = canManageAny
      ? await db
        .select({
          id: promotionCatalogOrders.id,
          status: promotionCatalogOrders.status,
          quantity: promotionCatalogOrders.quantity,
          totalPrice: promotionCatalogOrders.totalPrice,
          requestedAt: promotionCatalogOrders.requestedAt,
          deliveredAt: promotionCatalogOrders.deliveredAt,
          accountId: customerAccounts.id,
          accountName: customerAccounts.companyName,
          itemTitle: promotionCatalogItems.title,
        })
        .from(promotionCatalogOrders)
        .innerJoin(customerAccounts, eq(promotionCatalogOrders.accountId, customerAccounts.id))
        .innerJoin(promotionCatalogItems, eq(promotionCatalogOrders.catalogItemId, promotionCatalogItems.id))
        .orderBy(desc(promotionCatalogOrders.requestedAt))
      : await db
        .select({
          id: promotionCatalogOrders.id,
          status: promotionCatalogOrders.status,
          quantity: promotionCatalogOrders.quantity,
          totalPrice: promotionCatalogOrders.totalPrice,
          requestedAt: promotionCatalogOrders.requestedAt,
          deliveredAt: promotionCatalogOrders.deliveredAt,
          accountId: customerAccounts.id,
          accountName: customerAccounts.companyName,
          itemTitle: promotionCatalogItems.title,
        })
        .from(promotionCatalogOrders)
        .innerJoin(customerAccounts, eq(promotionCatalogOrders.accountId, customerAccounts.id))
        .innerJoin(promotionCatalogItems, eq(promotionCatalogOrders.catalogItemId, promotionCatalogItems.id))
        .where(eq(promotionCatalogOrders.assignedSalesRepUserId, session.user.id))
        .orderBy(desc(promotionCatalogOrders.requestedAt))

    const items = await db
      .select({
        id: promotionCatalogItems.id,
        title: promotionCatalogItems.title,
        description: promotionCatalogItems.description,
        category: promotionCatalogItems.category,
        imageUrl: promotionCatalogItems.imageUrl,
        price: promotionCatalogItems.price,
        isActive: promotionCatalogItems.isActive,
        isCustomizable: promotionCatalogItems.isCustomizable,
        leadTimeDays: promotionCatalogItems.leadTimeDays,
        fulfillmentType: promotionCatalogItems.fulfillmentType,
      })
      .from(promotionCatalogItems)
      .where(eq(promotionCatalogItems.isActive, true))
      .orderBy(desc(promotionCatalogItems.createdAt))

    return { items, accounts, orders }
  } catch (error) {
    if (isPromotionCatalogMissingTable(error)) {
      return { items: [], accounts: [], orders: [], missingTable: true as const }
    }
    throw error
  }
}

export async function getPromotionCatalogCustomerData() {
  const session = await requireRole('customer')

  try {
    const account = await getCustomerAccountForUser(session.user.id)
    if (!account) {
      return { items: [], orders: [], companyName: null }
    }

    const items = await db
      .select({
        itemId: promotionCatalogItems.id,
        availabilityId: promotionCatalogAccountAvailability.id,
        title: promotionCatalogItems.title,
        description: promotionCatalogItems.description,
        category: promotionCatalogItems.category,
        imageUrl: promotionCatalogItems.imageUrl,
        price: promotionCatalogItems.price,
        leadTimeDays: promotionCatalogItems.leadTimeDays,
        isCustomizable: promotionCatalogItems.isCustomizable,
        fulfillmentType: promotionCatalogItems.fulfillmentType,
        repRecommended: promotionCatalogAccountAvailability.repRecommended,
        publishedAt: promotionCatalogAccountAvailability.publishedAt,
      })
      .from(promotionCatalogAccountAvailability)
      .innerJoin(promotionCatalogItems, eq(promotionCatalogAccountAvailability.catalogItemId, promotionCatalogItems.id))
      .where(
        and(
          eq(promotionCatalogAccountAvailability.accountId, account.id),
          eq(promotionCatalogAccountAvailability.visibleToCustomer, true),
          eq(promotionCatalogItems.isActive, true),
          or(isNull(promotionCatalogAccountAvailability.expiresAt), sql`${promotionCatalogAccountAvailability.expiresAt} > now()`),
        ),
      )
      .orderBy(desc(promotionCatalogAccountAvailability.publishedAt))

    const orders = await db
      .select({
        id: promotionCatalogOrders.id,
        status: promotionCatalogOrders.status,
        quantity: promotionCatalogOrders.quantity,
        totalPrice: promotionCatalogOrders.totalPrice,
        requestedAt: promotionCatalogOrders.requestedAt,
        deliveredAt: promotionCatalogOrders.deliveredAt,
        itemTitle: promotionCatalogItems.title,
      })
      .from(promotionCatalogOrders)
      .innerJoin(promotionCatalogItems, eq(promotionCatalogOrders.catalogItemId, promotionCatalogItems.id))
      .where(eq(promotionCatalogOrders.accountId, account.id))
      .orderBy(desc(promotionCatalogOrders.requestedAt))

    return { items, orders, companyName: account.companyName }
  } catch (error) {
    if (isPromotionCatalogMissingTable(error)) {
      return { items: [], orders: [], companyName: null, missingTable: true as const }
    }
    throw error
  }
}

export async function createPromotionCatalogItem(
  _prev: { success?: boolean; error?: string } | null,
  formData: FormData,
) {
  const session = await requireRole('admin', 'sales_manager')

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const category = String(formData.get('category') ?? '').trim() as PromotionCategory
  const imageUrl = String(formData.get('imageUrl') ?? '').trim()
  const price = parseCurrencyInput(formData.get('price'))
  const sku = String(formData.get('sku') ?? '').trim() || null
  const leadTimeDaysValue = String(formData.get('leadTimeDays') ?? '').trim()
  const leadTimeDays = leadTimeDaysValue ? Number.parseInt(leadTimeDaysValue, 10) : null
  const fulfillmentType = String(formData.get('fulfillmentType') ?? 'printed').trim() as 'digital' | 'printed' | 'both'
  const notes = String(formData.get('notes') ?? '').trim() || null
  const isCustomizable = formData.get('isCustomizable') === 'on'

  if (!title || !imageUrl || !category) {
    return { error: 'Title, category, and image are required.' }
  }

  try {
    await db.insert(promotionCatalogItems).values({
      title,
      description,
      category,
      imageUrl,
      price,
      sku,
      isCustomizable,
      leadTimeDays: Number.isFinite(leadTimeDays ?? NaN) ? leadTimeDays : null,
      fulfillmentType,
      notes,
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
    })

    revalidatePromotionPaths()
    return { success: true as const }
  } catch (error) {
    if (isPromotionCatalogMissingTable(error)) {
      return { error: 'Promotion catalog tables are missing. Run npm run db:push and try again.' }
    }
    return { error: error instanceof Error ? error.message : 'Failed to create catalog item.' }
  }
}

export async function publishPromotionCatalogItem(formData: FormData) {
  const session = await requireRole('admin', 'sales_manager', 'sales_rep')
  const roles = session.user.roles ?? [session.user.role]
  const itemId = String(formData.get('itemId') ?? '')
  const accountId = String(formData.get('accountId') ?? '')
  const repRecommended = formData.get('repRecommended') === 'on'

  if (!itemId || !accountId) {
    return { error: 'Choose both an item and an account.' }
  }

  try {
    if (roles.includes('sales_rep') && !roles.some((role) => ['admin', 'sales_manager'].includes(role))) {
      await ensureRepCanManageAccount(session.user.id, accountId)
    }

    const [account] = await db
      .select({
        id: customerAccounts.id,
        companyName: customerAccounts.companyName,
        userId: customerAccounts.userId,
      })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, accountId))
      .limit(1)

    const [item] = await db
      .select({
        id: promotionCatalogItems.id,
        title: promotionCatalogItems.title,
      })
      .from(promotionCatalogItems)
      .where(eq(promotionCatalogItems.id, itemId))
      .limit(1)

    if (!account || !item) {
      return { error: 'Account or promotion item not found.' }
    }

    const [existing] = await db
      .select({ id: promotionCatalogAccountAvailability.id })
      .from(promotionCatalogAccountAvailability)
      .where(
        and(
          eq(promotionCatalogAccountAvailability.catalogItemId, itemId),
          eq(promotionCatalogAccountAvailability.accountId, accountId),
        ),
      )
      .limit(1)

    if (existing) {
      await db
        .update(promotionCatalogAccountAvailability)
        .set({
          assignedByUserId: session.user.id,
          visibleToCustomer: true,
          repRecommended,
          publishedAt: new Date(),
        })
        .where(eq(promotionCatalogAccountAvailability.id, existing.id))
    } else {
      await db.insert(promotionCatalogAccountAvailability).values({
        catalogItemId: itemId,
        accountId,
        assignedByUserId: session.user.id,
        visibleToCustomer: true,
        repRecommended,
      })
    }

    if (account.userId) {
      await createUserNotification({
        userId: account.userId,
        kind: 'promotion_catalog_published',
        title: 'New promotional catalog item available',
        body: `${item.title} is now available for ${account.companyName}.`,
        href: '/customer/promotion-catalog',
      })
    }

    revalidatePromotionPaths()
    return { success: true as const }
  } catch (error) {
    if (isPromotionCatalogMissingTable(error)) {
      return { error: 'Promotion catalog tables are missing. Run npm run db:push and try again.' }
    }
    return { error: error instanceof Error ? error.message : 'Failed to publish catalog item.' }
  }
}

export async function createPromotionCatalogOrder(formData: FormData) {
  const session = await requireRole('customer')
  const itemId = String(formData.get('itemId') ?? '')
  const quantity = parseQuantity(formData.get('quantity'))
  const customerNotes = String(formData.get('customerNotes') ?? '').trim() || null

  if (!itemId) {
    return { error: 'Catalog item is required.' }
  }

  try {
    const account = await getCustomerAccountForUser(session.user.id)
    if (!account) return { error: 'Customer account not found.' }

    const [published] = await db
      .select({
        itemId: promotionCatalogItems.id,
        title: promotionCatalogItems.title,
        price: promotionCatalogItems.price,
      })
      .from(promotionCatalogAccountAvailability)
      .innerJoin(promotionCatalogItems, eq(promotionCatalogAccountAvailability.catalogItemId, promotionCatalogItems.id))
      .where(
        and(
          eq(promotionCatalogAccountAvailability.accountId, account.id),
          eq(promotionCatalogAccountAvailability.catalogItemId, itemId),
          eq(promotionCatalogAccountAvailability.visibleToCustomer, true),
          eq(promotionCatalogItems.isActive, true),
          or(isNull(promotionCatalogAccountAvailability.expiresAt), sql`${promotionCatalogAccountAvailability.expiresAt} > now()`),
        ),
      )
      .limit(1)

    if (!published) {
      return { error: 'This catalog item is not available for your account.' }
    }

    const unitPrice = Number.parseFloat(published.price ?? '0')
    const totalPrice = (unitPrice * quantity).toFixed(2)

    let assignedSalesRepUserId: string | null = null
    if (account.assignedSalesRepId) {
      const [repUser] = await db
        .select({ userId: salesMembers.userId })
        .from(salesMembers)
        .where(eq(salesMembers.id, account.assignedSalesRepId))
        .limit(1)
      assignedSalesRepUserId = repUser?.userId ?? null
    }

    const [order] = await db.insert(promotionCatalogOrders).values({
      accountId: account.id,
      catalogItemId: itemId,
      requestedByUserId: session.user.id,
      assignedSalesMemberId: account.assignedSalesRepId ?? null,
      assignedSalesRepUserId,
      quantity,
      unitPrice: unitPrice.toFixed(2),
      totalPrice,
      customerNotes,
    }).returning({ id: promotionCatalogOrders.id })

    await logPromotionOrderEvent({
      orderId: order.id,
      actorUserId: session.user.id,
      kind: 'requested',
      title: 'Customer requested promotion support',
      body: `${published.title} x${quantity}`,
    })

    await createNotificationsForRoles({
      roles: ['admin', 'sales_manager'],
      kind: 'promotion_catalog_requested',
      title: `Promotion request from ${account.companyName}`,
      body: `${published.title} x${quantity}`,
      href: '/admin/sales/promotion-catalog',
    })

    if (assignedSalesRepUserId) {
      await createUserNotification({
        userId: assignedSalesRepUserId,
        kind: 'promotion_catalog_requested',
        title: `Promotion request from ${account.companyName}`,
        body: `${published.title} x${quantity}`,
        href: '/sales/promotion-catalog',
      })
    }

    revalidatePromotionPaths()
    return { success: true as const }
  } catch (error) {
    if (isPromotionCatalogMissingTable(error)) {
      return { error: 'Promotion catalog tables are missing. Run npm run db:push and try again.' }
    }
    return { error: error instanceof Error ? error.message : 'Failed to submit promotion request.' }
  }
}

export async function updatePromotionCatalogOrder(formData: FormData) {
  const session = await requireRole('admin', 'sales_manager', 'sales_rep')
  const roles = session.user.roles ?? [session.user.role]
  const orderId = String(formData.get('orderId') ?? '')
  const status = String(formData.get('status') ?? '').trim() as PromotionOrderStatus
  const internalNotes = String(formData.get('internalNotes') ?? '').trim() || null

  if (!orderId || !status) {
    return { error: 'Order and status are required.' }
  }

  try {
    const [order] = await db
      .select({
        id: promotionCatalogOrders.id,
        accountId: promotionCatalogOrders.accountId,
        assignedSalesRepUserId: promotionCatalogOrders.assignedSalesRepUserId,
        requestedByUserId: promotionCatalogOrders.requestedByUserId,
        itemTitle: promotionCatalogItems.title,
        accountName: customerAccounts.companyName,
      })
      .from(promotionCatalogOrders)
      .innerJoin(customerAccounts, eq(promotionCatalogOrders.accountId, customerAccounts.id))
      .innerJoin(promotionCatalogItems, eq(promotionCatalogOrders.catalogItemId, promotionCatalogItems.id))
      .where(eq(promotionCatalogOrders.id, orderId))
      .limit(1)

    if (!order) return { error: 'Promotion request not found.' }

    if (roles.includes('sales_rep') && !roles.some((role) => ['admin', 'sales_manager'].includes(role))) {
      if (order.assignedSalesRepUserId !== session.user.id) {
        return { error: 'You can only update promotion requests for your assigned accounts.' }
      }
    }

    const now = new Date()
    await db
      .update(promotionCatalogOrders)
      .set({
        status,
        internalNotes,
        updatedAt: now,
        ...(status === 'approved' ? { approvedAt: now } : {}),
        ...(status === 'in_production' ? { inProductionAt: now } : {}),
        ...(status === 'ready_for_delivery' ? { readyAt: now } : {}),
        ...(status === 'delivered' ? { deliveredAt: now, deliveredByUserId: session.user.id } : {}),
        ...(status === 'completed' ? { completedAt: now } : {}),
        ...(status === 'cancelled' ? { cancelledAt: now } : {}),
      })
      .where(eq(promotionCatalogOrders.id, orderId))

    await logPromotionOrderEvent({
      orderId,
      actorUserId: session.user.id,
      kind: status,
      title: statusTitle(status),
      body: internalNotes,
    })

    if (order.requestedByUserId) {
      await createUserNotification({
        userId: order.requestedByUserId,
        kind: 'promotion_catalog_status_changed',
        title: statusTitle(status),
        body: `${order.itemTitle} for ${order.accountName}`,
        href: '/customer/promotion-catalog',
      })
    }

    if (order.assignedSalesRepUserId) {
      await createUserNotification({
        userId: order.assignedSalesRepUserId,
        kind: status === 'delivered' ? 'promotion_catalog_delivered' : 'promotion_catalog_status_changed',
        title: statusTitle(status),
        body: `${order.itemTitle} for ${order.accountName}`,
        href: '/sales/promotion-catalog',
      })
    }

    revalidatePromotionPaths()
    return { success: true as const }
  } catch (error) {
    if (isPromotionCatalogMissingTable(error)) {
      return { error: 'Promotion catalog tables are missing. Run npm run db:push and try again.' }
    }
    return { error: error instanceof Error ? error.message : 'Failed to update promotion request.' }
  }
}
