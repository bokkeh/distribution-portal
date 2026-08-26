'use server'

import { randomUUID } from 'crypto'
import { and, eq, gte, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import {
  inventoryLocationBalances,
  inventoryLocationMovements,
  inventoryLocations,
  inventoryLocationThresholds,
  inventoryLowStockAlerts,
  products,
  quickBooksCategoryMappings,
  quickBooksExports,
  QUICKBOOKS_SAMPLE_CATEGORIES,
  replenishmentRequests,
  sampleRequestItems,
  sampleRequests,
  sampleRequestStatusHistory,
  users,
  type QuickBooksSampleCategory,
} from '@/db/schema'
import { requireAdmin, requireAdminOrStaff } from '@/lib/auth/session'

type ActionResult = { success?: true; error?: string; requestId?: string }

const integer = (value: FormDataEntryValue | null) => Math.max(0, Number.parseInt(String(value ?? '0'), 10) || 0)
const text = (value: FormDataEntryValue | null) => String(value ?? '').trim()

function refresh() {
  revalidatePath('/admin/sample-inventory')
  revalidatePath('/staff/sample-inventory')
}

function isCategory(value: string): value is QuickBooksSampleCategory {
  return QUICKBOOKS_SAMPLE_CATEGORIES.includes(value as QuickBooksSampleCategory)
}

async function ensureBalance(locationId: string, productId: string) {
  await db.insert(inventoryLocationBalances).values({ locationId, productId }).onConflictDoNothing()
}

async function updateLowStockAlert(locationId: string, productId: string) {
  const [state] = await db
    .select({
      cases: inventoryLocationBalances.quantityCases,
      bottles: inventoryLocationBalances.quantityBottles,
      minimumCases: inventoryLocationThresholds.minimumCases,
      minimumBottles: inventoryLocationThresholds.minimumBottles,
    })
    .from(inventoryLocationBalances)
    .leftJoin(inventoryLocationThresholds, and(
      eq(inventoryLocationThresholds.locationId, inventoryLocationBalances.locationId),
      eq(inventoryLocationThresholds.productId, inventoryLocationBalances.productId),
    ))
    .where(and(eq(inventoryLocationBalances.locationId, locationId), eq(inventoryLocationBalances.productId, productId)))

  if (!state || state.minimumCases == null) return
  const low = state.cases < state.minimumCases || state.bottles < (state.minimumBottles ?? 0)
  if (low) {
    await db.insert(inventoryLowStockAlerts).values({
      locationId,
      productId,
      currentCases: state.cases,
      currentBottles: state.bottles,
      minimumCases: state.minimumCases,
      minimumBottles: state.minimumBottles ?? 0,
    }).onConflictDoNothing()
  } else {
    await db.update(inventoryLowStockAlerts).set({ status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(inventoryLowStockAlerts.locationId, locationId), eq(inventoryLowStockAlerts.productId, productId), eq(inventoryLowStockAlerts.status, 'open')))
  }
}

export async function setLocationBalance(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdmin()
    const locationId = text(formData.get('locationId'))
    const productId = text(formData.get('productId'))
    const quantityCases = integer(formData.get('quantityCases'))
    const quantityBottles = integer(formData.get('quantityBottles'))
    const category = text(formData.get('quickBooksCategory'))
    const reason = text(formData.get('reason'))
    if (!locationId || !productId || !reason) return { error: 'Location, product, and adjustment reason are required.' }
    if (!isCategory(category)) return { error: 'Choose a valid adjustment category.' }

    await ensureBalance(locationId, productId)
    const [before] = await db.select().from(inventoryLocationBalances)
      .where(and(eq(inventoryLocationBalances.locationId, locationId), eq(inventoryLocationBalances.productId, productId)))
    if (before.quantityCases === quantityCases && before.quantityBottles === quantityBottles) return { success: true }
    await db.update(inventoryLocationBalances).set({ quantityCases, quantityBottles, updatedAt: new Date() })
      .where(eq(inventoryLocationBalances.id, before.id))
    await db.insert(inventoryLocationMovements).values({
      idempotencyKey: `adjustment:${randomUUID()}`,
      type: before.quantityCases === 0 && before.quantityBottles === 0 ? 'opening_balance' : 'adjustment',
      productId,
      destinationLocationId: locationId,
      quantityCases: Math.abs(quantityCases - before.quantityCases),
      quantityBottles: Math.abs(quantityBottles - before.quantityBottles),
      quickBooksCategory: category,
      reason: `${reason} (balance ${before.quantityCases} cases/${before.quantityBottles} bottles to ${quantityCases}/${quantityBottles})`,
      actorUserId: session.user.id,
      approvedByUserId: session.user.id,
    })
    await updateLowStockAlert(locationId, productId)
    refresh()
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to update balance.' }
  }
}

export async function saveLocationThreshold(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdmin()
    const locationId = text(formData.get('locationId'))
    const productId = text(formData.get('productId'))
    await db.insert(inventoryLocationThresholds).values({
      locationId,
      productId,
      minimumCases: integer(formData.get('minimumCases')),
      minimumBottles: integer(formData.get('minimumBottles')),
      updatedByUserId: session.user.id,
    }).onConflictDoUpdate({
      target: [inventoryLocationThresholds.locationId, inventoryLocationThresholds.productId],
      set: {
        minimumCases: integer(formData.get('minimumCases')),
        minimumBottles: integer(formData.get('minimumBottles')),
        updatedByUserId: session.user.id,
        updatedAt: new Date(),
      },
    })
    await updateLowStockAlert(locationId, productId)
    refresh()
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to save threshold.' }
  }
}

export async function assignSampleLocationOwner(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin()
    const locationId = text(formData.get('locationId'))
    const ownerUserId = text(formData.get('ownerUserId'))
    if (!locationId || !ownerUserId) return { error: 'Choose a sample location and inventory owner.' }

    const [[location], [owner]] = await Promise.all([
      db.select({ id: inventoryLocations.id, type: inventoryLocations.type })
        .from(inventoryLocations)
        .where(eq(inventoryLocations.id, locationId))
        .limit(1),
      db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, ownerUserId), eq(users.active, true)))
        .limit(1),
    ])

    if (!location || location.type !== 'sample') return { error: 'Sample location not found.' }
    if (!owner) return { error: 'Active inventory owner not found.' }

    await db.update(inventoryLocations)
      .set({ ownerUserId, updatedAt: new Date() })
      .where(eq(inventoryLocations.id, locationId))
    refresh()
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to assign the inventory owner.' }
  }
}

export async function createSampleRequest(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdminOrStaff()
    const sourceLocationId = text(formData.get('sourceLocationId'))
    const productId = text(formData.get('productId'))
    const category = text(formData.get('quickBooksCategory'))
    const quantityCases = integer(formData.get('quantityCases'))
    const quantityBottles = integer(formData.get('quantityBottles'))
    const purpose = text(formData.get('purpose'))
    const recipientName = text(formData.get('recipientName'))
    const idempotencyKey = text(formData.get('idempotencyKey')) || randomUUID()
    if (!isCategory(category)) return { error: 'Choose a valid QuickBooks category.' }
    if (!sourceLocationId || !productId || !purpose || !recipientName) return { error: 'Complete all required request fields.' }
    if (quantityCases + quantityBottles === 0) return { error: 'Request at least one case or bottle.' }

    const existing = await db.select({ id: sampleRequests.id }).from(sampleRequests).where(eq(sampleRequests.idempotencyKey, idempotencyKey)).limit(1)
    if (existing[0]) return { success: true, requestId: existing[0].id }

    const [product] = await db.select({ samplePrice: products.samplePrice, bottlePrice: products.bottlePrice })
      .from(products).where(eq(products.id, productId)).limit(1)
    if (!product) return { error: 'Product not found.' }
    const estimatedCost = quantityCases * Number(product.samplePrice) + quantityBottles * Number(product.bottlePrice)

    await ensureBalance(sourceLocationId, productId)
    const [debited] = await db.update(inventoryLocationBalances).set({
      quantityCases: sql`${inventoryLocationBalances.quantityCases} - ${quantityCases}`,
      quantityBottles: sql`${inventoryLocationBalances.quantityBottles} - ${quantityBottles}`,
      updatedAt: new Date(),
    }).where(and(
      eq(inventoryLocationBalances.locationId, sourceLocationId),
      eq(inventoryLocationBalances.productId, productId),
      gte(inventoryLocationBalances.quantityCases, quantityCases),
      gte(inventoryLocationBalances.quantityBottles, quantityBottles),
    )).returning({ id: inventoryLocationBalances.id })
    if (!debited) return { error: 'Insufficient stock at this location.' }

    try {
      const [request] = await db.insert(sampleRequests).values({
        idempotencyKey,
        status: 'fulfilled',
        sourceLocationId,
        responsibleUserId: text(formData.get('responsibleUserId')) || session.user.id,
        recipientType: (text(formData.get('recipientType')) || 'other') as 'customer' | 'prospect' | 'event' | 'charity' | 'internal' | 'other',
        recipientName,
        recipientEmail: text(formData.get('recipientEmail')) || null,
        recipientDetails: text(formData.get('recipientDetails')) || null,
        quickBooksCategory: category,
        customerAccountId: text(formData.get('customerAccountId')) || null,
        purpose,
        notes: text(formData.get('notes')) || null,
        replenishFromWarehouse: formData.get('replenishFromWarehouse') === 'on',
        totalEstimatedCost: estimatedCost.toFixed(2),
        requestedByUserId: session.user.id,
        approvedByUserId: session.user.id,
        fulfilledByUserId: session.user.id,
        submittedAt: new Date(), approvedAt: new Date(), fulfilledAt: new Date(),
      }).returning()

      await db.insert(sampleRequestItems).values({ sampleRequestId: request.id, productId, quantityCases, quantityBottles, estimatedUnitCost: product.samplePrice, estimatedTotalCost: estimatedCost.toFixed(2) })
      await db.insert(sampleRequestStatusHistory).values({ sampleRequestId: request.id, fromStatus: null, toStatus: 'fulfilled', note: 'Submitted and fulfilled from location stock', actorUserId: session.user.id })
      await db.insert(inventoryLocationMovements).values({
        idempotencyKey: `sample:${idempotencyKey}`, type: 'sample_usage', productId, sourceLocationId,
        quantityCases, quantityBottles, sampleRequestId: request.id, quickBooksCategory: category,
        estimatedCost: estimatedCost.toFixed(2), reason: purpose, actorUserId: session.user.id, approvedByUserId: session.user.id,
      })

      const [mapping] = await db.select().from(quickBooksCategoryMappings).where(eq(quickBooksCategoryMappings.category, category)).limit(1)
      const exportStatus = !mapping?.accountId ? 'pending_mapping' : mapping.requiresApproval ? 'pending_approval' : 'ready'
      await db.insert(quickBooksExports).values({
        idempotencyKey: `sample-request:${request.id}`,
        sampleRequestId: request.id,
        mappingId: mapping?.id ?? null,
        status: exportStatus,
        payload: { requestNumber: request.requestNumber, category, recipientName, purpose, amount: estimatedCost.toFixed(2), accountId: mapping?.accountId ?? null, classId: mapping?.classId ?? null },
      })

      if (request.replenishFromWarehouse) {
        const [warehouse] = await db.select({ id: inventoryLocations.id }).from(inventoryLocations).where(eq(inventoryLocations.name, 'Warehouse - Landover')).limit(1)
        if (warehouse && warehouse.id !== sourceLocationId) {
          await db.insert(replenishmentRequests).values({
            idempotencyKey: `sample-request:${request.id}:${productId}`,
            sampleRequestId: request.id, sourceLocationId: warehouse.id, destinationLocationId: sourceLocationId,
            productId, requestedCases: quantityCases, requestedBottles: quantityBottles, requestedByUserId: session.user.id,
          })
        }
      }
      await updateLowStockAlert(sourceLocationId, productId)
      refresh()
      return { success: true, requestId: request.id }
    } catch (error) {
      await db.update(inventoryLocationBalances).set({
        quantityCases: sql`${inventoryLocationBalances.quantityCases} + ${quantityCases}`,
        quantityBottles: sql`${inventoryLocationBalances.quantityBottles} + ${quantityBottles}`,
        updatedAt: new Date(),
      }).where(and(eq(inventoryLocationBalances.locationId, sourceLocationId), eq(inventoryLocationBalances.productId, productId)))
      throw error
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create sample request.' }
  }
}

export async function fulfillReplenishment(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdminOrStaff()
    const id = text(formData.get('replenishmentId'))
    const cases = integer(formData.get('quantityCases'))
    const bottles = integer(formData.get('quantityBottles'))
    const [request] = await db.select().from(replenishmentRequests).where(eq(replenishmentRequests.id, id)).limit(1)
    if (!request || ['fulfilled', 'cancelled'].includes(request.status)) return { error: 'Replenishment is not open.' }
    const remainingCases = request.requestedCases - request.fulfilledCases
    const remainingBottles = request.requestedBottles - request.fulfilledBottles
    if (cases + bottles === 0 || cases > remainingCases || bottles > remainingBottles) return { error: 'Fulfillment exceeds the remaining request.' }

    await ensureBalance(request.sourceLocationId, request.productId)
    await ensureBalance(request.destinationLocationId, request.productId)
    const [debited] = await db.update(inventoryLocationBalances).set({
      quantityCases: sql`${inventoryLocationBalances.quantityCases} - ${cases}`,
      quantityBottles: sql`${inventoryLocationBalances.quantityBottles} - ${bottles}`,
      updatedAt: new Date(),
    }).where(and(eq(inventoryLocationBalances.locationId, request.sourceLocationId), eq(inventoryLocationBalances.productId, request.productId), gte(inventoryLocationBalances.quantityCases, cases), gte(inventoryLocationBalances.quantityBottles, bottles))).returning()
    if (!debited) return { error: 'Warehouse stock is insufficient.' }

    await db.update(inventoryLocationBalances).set({
      quantityCases: sql`${inventoryLocationBalances.quantityCases} + ${cases}`,
      quantityBottles: sql`${inventoryLocationBalances.quantityBottles} + ${bottles}`,
      updatedAt: new Date(),
    }).where(and(eq(inventoryLocationBalances.locationId, request.destinationLocationId), eq(inventoryLocationBalances.productId, request.productId)))
    const fulfilled = cases === remainingCases && bottles === remainingBottles
    await db.update(replenishmentRequests).set({
      fulfilledCases: sql`${replenishmentRequests.fulfilledCases} + ${cases}`,
      fulfilledBottles: sql`${replenishmentRequests.fulfilledBottles} + ${bottles}`,
      status: fulfilled ? 'fulfilled' : 'partially_fulfilled', fulfilledByUserId: session.user.id,
      fulfilledAt: fulfilled ? new Date() : null, updatedAt: new Date(),
    }).where(eq(replenishmentRequests.id, id))
    await db.insert(inventoryLocationMovements).values({
      idempotencyKey: `replenishment:${id}:${randomUUID()}`, type: 'replenishment', productId: request.productId,
      sourceLocationId: request.sourceLocationId, destinationLocationId: request.destinationLocationId,
      quantityCases: cases, quantityBottles: bottles, sampleRequestId: request.sampleRequestId,
      reason: `Replenishment ${fulfilled ? 'fulfilled' : 'partially fulfilled'}`, actorUserId: session.user.id, approvedByUserId: session.user.id,
    })
    await updateLowStockAlert(request.sourceLocationId, request.productId)
    await updateLowStockAlert(request.destinationLocationId, request.productId)
    refresh()
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to fulfill replenishment.' }
  }
}

export async function saveQuickBooksMapping(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdmin()
    const category = text(formData.get('category'))
    if (!isCategory(category)) return { error: 'Invalid category.' }
    const values = {
      accountId: text(formData.get('accountId')) || null,
      accountName: text(formData.get('accountName')) || null,
      classId: text(formData.get('classId')) || null,
      className: text(formData.get('className')) || null,
      memoTemplate: text(formData.get('memoTemplate')) || null,
      autoExport: formData.get('autoExport') === 'on',
      requiresApproval: formData.get('requiresApproval') === 'on',
      updatedByUserId: session.user.id,
      updatedAt: new Date(),
    }
    await db.insert(quickBooksCategoryMappings).values({ category, ...values }).onConflictDoUpdate({ target: quickBooksCategoryMappings.category, set: values })
    await db.update(quickBooksExports).set({ status: values.accountId ? 'pending_approval' : 'pending_mapping', updatedAt: new Date() })
      .where(eq(quickBooksExports.status, 'pending_mapping'))
    refresh()
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to save mapping.' }
  }
}

export async function markQuickBooksExported(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAdmin()
    const exportId = text(formData.get('exportId'))
    const externalTransactionId = text(formData.get('externalTransactionId'))
    if (!externalTransactionId) return { error: 'QuickBooks transaction ID is required.' }
    await db.update(quickBooksExports).set({ status: 'exported', externalTransactionId, exportedByUserId: session.user.id, exportedAt: new Date(), updatedAt: new Date() }).where(eq(quickBooksExports.id, exportId))
    refresh()
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to mark export complete.' }
  }
}
