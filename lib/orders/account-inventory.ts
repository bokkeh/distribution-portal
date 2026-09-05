import 'server-only'

import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orderItems, orders, products } from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'
import { roundInventoryValue, toInventoryFixed } from '@/lib/crm/account-inventory-ledger'

async function applyOrderInventoryCredit(input: {
  orderId: string
  accountId: string
  productId: string
  sku: string
  productName: string
  bottlesPerCase: number
  bottles: number
  effectiveAt: Date
  actorUserId: string
}) {
  const orderReference = input.orderId.slice(-8).toUpperCase()
  const result = await db.execute(sql`
    WITH inserted_adjustment AS (
      INSERT INTO account_inventory_adjustments (
        account_id, product_id, source_order_id, sku, product_name, change_type,
        delta_cases, delta_bottles, resulting_cases_on_hand, resulting_bottles_on_hand,
        effective_at, notes, created_by_user_id, updated_by_user_id, updated_at
      )
      VALUES (
        ${input.accountId}, ${input.productId}, ${input.orderId}, ${input.sku}, ${input.productName}, 'order_fulfillment',
        '0.00', ${toInventoryFixed(input.bottles)}, '0.00', '0.00',
        ${input.effectiveAt}, ${`Added automatically from paid and fulfilled order ${orderReference}.`},
        ${input.actorUserId}, ${input.actorUserId}, now()
      )
      ON CONFLICT (source_order_id, product_id) DO NOTHING
      RETURNING id, account_id, product_id, sku, product_name, delta_cases, delta_bottles
    ), upserted_inventory AS (
      INSERT INTO account_inventory_on_hand (
        account_id, product_id, sku, product_name, unit_type, quantity_on_hand,
        cases_on_hand, bottles_on_hand, updated_by_user_id, created_at, updated_at
      )
      SELECT
        account_id, product_id, sku, product_name, 'bottle', delta_bottles,
        '0.00', delta_bottles, ${input.actorUserId}, now(), ${input.effectiveAt}
      FROM inserted_adjustment
      ON CONFLICT (account_id, product_id) DO UPDATE SET
        sku = EXCLUDED.sku,
        product_name = EXCLUDED.product_name,
        unit_type = 'bottle',
        quantity_on_hand = account_inventory_on_hand.bottles_on_hand
          + (account_inventory_on_hand.cases_on_hand * ${input.bottlesPerCase})
          + EXCLUDED.bottles_on_hand,
        cases_on_hand = '0.00',
        bottles_on_hand = account_inventory_on_hand.bottles_on_hand
          + (account_inventory_on_hand.cases_on_hand * ${input.bottlesPerCase})
          + EXCLUDED.bottles_on_hand,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = EXCLUDED.updated_at
      RETURNING id, account_id, product_id, cases_on_hand, bottles_on_hand
    )
    UPDATE account_inventory_adjustments AS adjustment
    SET
      inventory_item_id = inventory.id,
      resulting_cases_on_hand = '0.00',
      resulting_bottles_on_hand = inventory.bottles_on_hand,
      updated_at = now()
    FROM inserted_adjustment AS inserted, upserted_inventory AS inventory
    WHERE adjustment.id = inserted.id
      AND inventory.account_id = inserted.account_id
      AND inventory.product_id = inserted.product_id
    RETURNING adjustment.id
  `)

  return (result.rows?.length ?? 0) > 0
}

export async function syncOrderAccountInventory(orderId: string, actorUserId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)

  if (!order || order.status !== 'fulfilled' || order.paymentStatus !== 'paid') {
    return { credited: false, customerId: order?.customerId ?? null }
  }

  const lineItems = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      unit: orderItems.unit,
      sku: products.sku,
      productName: products.name,
      bottlesPerCase: products.bottlesPerCase,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.id))

  const productCredits = new Map<string, {
    productId: string
    sku: string
    productName: string
    bottlesPerCase: number
    bottles: number
  }>()

  for (const item of lineItems) {
    const credit = productCredits.get(item.productId) ?? {
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      bottlesPerCase: item.bottlesPerCase,
      bottles: 0,
    }
    const quantity = Number(item.quantity)
    const bottleQuantity = item.unit === 'bottle' ? quantity : quantity * item.bottlesPerCase
    credit.bottles = roundInventoryValue(credit.bottles + bottleQuantity)
    productCredits.set(item.productId, credit)
  }

  let creditedProducts = 0
  let creditedBottles = 0
  const effectiveAt = new Date()
  const orderReference = order.id.slice(-8).toUpperCase()

  for (const credit of productCredits.values()) {
    const inserted = await applyOrderInventoryCredit({
      orderId: order.id,
      accountId: order.customerId,
      productId: credit.productId,
      sku: credit.sku,
      productName: credit.productName,
      bottlesPerCase: credit.bottlesPerCase,
      bottles: credit.bottles,
      effectiveAt,
      actorUserId,
    })

    if (inserted) {
      creditedProducts += 1
      creditedBottles = roundInventoryValue(creditedBottles + credit.bottles)
    }
  }

  if (creditedProducts > 0) {
    await logActivityEvent({
      entityType: 'account',
      entityId: order.customerId,
      actorUserId,
      kind: 'order_inventory_received',
      title: 'Order added to account inventory',
      body: `Paid and fulfilled order ${orderReference} added ${creditedBottles.toFixed(2)} bottles across ${creditedProducts} product${creditedProducts === 1 ? '' : 's'} to inventory on hand.`,
      metadata: { orderId: order.id, productCount: creditedProducts, bottleCount: creditedBottles },
    })
  }

  return { credited: creditedProducts > 0, customerId: order.customerId }
}
