import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { customerAccounts, inventory, orderItems, products } from '@/db/schema'
import { getPricingRulesForProducts, normalizeAccountGeography, resolveProductCasePrice } from '@/lib/pricing/geographic-service'
import type { GeographicPricingSource } from '@/lib/pricing/geographic'

export type CheckoutOrderType = 'paid' | 'sample'
export type PurchaseUnit = 'case' | 'bottle'

type PricingContext = {
  accountId: string | null
  businessType: string | null
  state: string | null
  county: string | null
}

type InventoryRow = typeof inventory.$inferSelect
type ProductRow = typeof products.$inferSelect

export function computeDeliveryFee(
  deliveryTiming: string | null | undefined,
  preferredDeliveryDay: string | null | undefined,
) {
  if (deliveryTiming !== 'time_sensitive') return 0
  return preferredDeliveryDay && ['saturday', 'sunday'].includes(preferredDeliveryDay.toLowerCase()) ? 50 : 30
}

export function getBottleUnitPrice(product: ProductRow, resolvedCasePrice: number) {
  const explicitBottlePrice = parseFloat(product.bottlePrice || '0')
  if (explicitBottlePrice > 0) {
    return { unitPrice: explicitBottlePrice, inheritsCasePricing: false }
  }

  const bottlesPerCase = product.bottlesPerCase || 12
  return {
    unitPrice: resolvedCasePrice / bottlesPerCase,
    inheritsCasePricing: true,
  }
}

export async function getAccountPricingContext(customerId: string): Promise<PricingContext> {
  const [account] = await db
    .select({
      accountId: customerAccounts.id,
      businessType: customerAccounts.businessType,
      state: customerAccounts.state,
      county: customerAccounts.county,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, customerId))
    .limit(1)

  if (!account) {
    throw new Error('Customer account not found')
  }

  return normalizeAccountGeography(account)
}

export async function buildPricedLineItems(input: {
  customerId: string
  purchaseUnit: PurchaseUnit
  orderDate: Date
  orderType: CheckoutOrderType
  items: { productId: string; quantity: number }[]
  customerBusinessType: string | null
}) {
  if (!input.items.length) {
    throw new Error('Add at least one item to the order')
  }

  const productIds = input.items.map((item) => item.productId)
  const [productList, inventoryRows, pricingContext, pricingRules] = await Promise.all([
    db.select().from(products).where(inArray(products.id, productIds)),
    db.select().from(inventory).where(inArray(inventory.productId, productIds)),
    getAccountPricingContext(input.customerId),
    getPricingRulesForProducts(productIds),
  ])

  const productMap = new Map(productList.map((product) => [product.id, product]))
  const inventoryMap = new Map(inventoryRows.map((row) => [row.productId, row]))
  let subtotal = 0

  const lineItems: Array<typeof orderItems.$inferInsert> = input.items.map((item) => {
    const product = productMap.get(item.productId)
    const inv = inventoryMap.get(item.productId)
    if (!product) {
      throw new Error(`Product ${item.productId} not found`)
    }
    if (!inv) {
      throw new Error(`Inventory record missing for product ${product.name}`)
    }

    const bottlesPerCase = product.bottlesPerCase || 12
    const availableQuantity = input.purchaseUnit === 'bottle'
      ? inv.quantityPaid * bottlesPerCase - inv.looseBottlePaid
      : inv.quantityPaid

    if (item.quantity > availableQuantity) {
      throw new Error(`Not enough ${input.purchaseUnit}s in stock for ${product.name}`)
    }

    const paidPricing = input.orderType === 'paid'
      ? resolveProductCasePrice({
          productId: item.productId,
          baseCasePrice: product.price,
          account: pricingContext,
          rules: pricingRules,
          asOf: input.orderDate,
          quantityCases: input.purchaseUnit === 'case' ? item.quantity : null,
        })
      : null

    const parsedSamplePrice = parseFloat(product.samplePrice || '0')
    const resolvedCasePrice = input.orderType === 'sample'
      ? (Number.isFinite(parsedSamplePrice) ? parsedSamplePrice : 0)
      : paidPricing?.price ?? parseFloat(product.price)

    const bottlePricing = getBottleUnitPrice(product, resolvedCasePrice)
    const unitPrice = input.purchaseUnit === 'case'
      ? resolvedCasePrice
      : bottlePricing.unitPrice

    const total = unitPrice * item.quantity
    subtotal += total

    const pricingSource: GeographicPricingSource | null =
      input.orderType === 'paid' && (input.purchaseUnit === 'case' || bottlePricing.inheritsCasePricing)
        ? paidPricing?.source ?? null
        : null

    return {
      orderId: '',
      productId: item.productId,
      quantity: String(item.quantity),
      unit: input.purchaseUnit,
      unitPrice: unitPrice.toFixed(2),
      total: total.toFixed(2),
      pricingSource,
      pricingRuleId: pricingSource ? paidPricing?.matchedRule?.id ?? null : null,
      pricingState: pricingSource ? paidPricing?.matchedState ?? null : null,
      pricingCounty: pricingSource ? paidPricing?.matchedCounty ?? null : null,
    }
  })

  return { lineItems, subtotal, productMap, inventoryMap }
}

export type CheckoutInventoryMap = Map<string, InventoryRow>
export type CheckoutProductMap = Map<string, ProductRow>
