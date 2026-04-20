'use server'

import { and, asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { accountInventoryAdjustments, accountInventoryOnHand, accountMedia, accountNotes, customerAccounts, products, salesMembers } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import type { AccountInventoryItem } from '@/lib/crm/account-detail-data'

const INTERNAL_ACCOUNT_ROLES = ['admin', 'staff', 'driver', 'taster', 'sales_rep', 'sales_manager'] as const
const ACCOUNT_MEDIA_UPLOAD_ROLES = ['admin', 'sales_rep', 'sales_manager'] as const
const ACCOUNT_MEDIA_CATEGORIES = new Set(['tasting', 'store_visit', 'delivery', 'customers', 'employees', 'events'])

function normalizeWhitespace(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function revalidateAccountPaths(accountId: string) {
  revalidatePath(`/admin/crm/${accountId}`)
  revalidatePath(`/staff/crm/${accountId}`)
  revalidatePath(`/sales/accounts/${accountId}`)
}

function getPrimaryRole(session: Awaited<ReturnType<typeof requireRole>>) {
  const roles = session.user.roles ?? []
  return roles.find((role) => INTERNAL_ACCOUNT_ROLES.includes(role as typeof INTERNAL_ACCOUNT_ROLES[number])) ?? session.user.role ?? 'system'
}

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
}

function isMissingTable(error: unknown, tableName: string) {
  const message = getErrorText(error)
  return message.includes(tableName.toLowerCase()) && message.includes('does not exist')
}

async function requireAccountMediaUploadAccess(accountId: string) {
  const session = await requireRole(...ACCOUNT_MEDIA_UPLOAD_ROLES)
  const roles = new Set((session.user.roles ?? [session.user.role]).filter(Boolean) as string[])
  const canManageAny = roles.has('admin') || roles.has('sales_manager')

  const [account] = await db
    .select({
      id: customerAccounts.id,
      companyName: customerAccounts.companyName,
      assignedSalesRepId: customerAccounts.assignedSalesRepId,
    })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) {
    throw new Error('Account not found.')
  }

  if (!canManageAny) {
    const [member] = await db
      .select({ id: salesMembers.id })
      .from(salesMembers)
      .where(eq(salesMembers.userId, session.user.id))
      .limit(1)

    if (!member || account.assignedSalesRepId !== member.id) {
      throw new Error('You are not assigned to this account.')
    }
  }

  return { session, account }
}

function roundInventoryValue(value: number) {
  return Math.round(value * 100) / 100
}

function toInventoryFixed(value: number) {
  return roundInventoryValue(value).toFixed(2)
}

function parseInventoryNumber(value: string, label: string) {
  const parsed = Number(value || '0')
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be zero or greater.`)
  }
  return roundInventoryValue(parsed)
}

function parseInventoryDateInput(value: string) {
  if (!value) return new Date()
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Inventory date is invalid.')
  }
  return parsed
}

async function buildAccountInventoryItem(itemId: string): Promise<AccountInventoryItem | null> {
  const [item] = await db
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
      updatedAt: accountInventoryOnHand.updatedAt,
    })
    .from(accountInventoryOnHand)
    .where(eq(accountInventoryOnHand.id, itemId))
    .limit(1)

  if (!item) return null

  return {
    ...item,
    updatedByName: null,
    updatedByRole: null,
  }
}

async function rebuildAccountInventorySnapshot(input: {
  accountId: string
  productId: string
}) {
  const [adjustments, [product], [existingItem]] = await Promise.all([
    db
      .select()
      .from(accountInventoryAdjustments)
      .where(and(
        eq(accountInventoryAdjustments.accountId, input.accountId),
        eq(accountInventoryAdjustments.productId, input.productId),
      ))
      .orderBy(
        asc(accountInventoryAdjustments.effectiveAt),
        asc(accountInventoryAdjustments.createdAt),
        asc(accountInventoryAdjustments.id),
      ),
    db
      .select({ id: products.id, sku: products.sku, name: products.name, unit: products.unit })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1),
    db
      .select()
      .from(accountInventoryOnHand)
      .where(and(
        eq(accountInventoryOnHand.accountId, input.accountId),
        eq(accountInventoryOnHand.productId, input.productId),
      ))
      .limit(1),
  ])

  if (!product) {
    throw new Error('Product not found.')
  }

  let runningCases = 0
  let runningBottles = 0

  for (const adjustment of adjustments) {
    runningCases = roundInventoryValue(runningCases + Number(adjustment.deltaCases ?? 0))
    runningBottles = roundInventoryValue(runningBottles + Number(adjustment.deltaBottles ?? 0))

    await db.update(accountInventoryAdjustments).set({
      resultingCasesOnHand: toInventoryFixed(runningCases),
      resultingBottlesOnHand: toInventoryFixed(runningBottles),
    }).where(eq(accountInventoryAdjustments.id, adjustment.id))
  }

  const finalCases = toInventoryFixed(runningCases)
  const finalBottles = toInventoryFixed(runningBottles)
  const finalIsZero = Number(finalCases) === 0 && Number(finalBottles) === 0
  const latestAdjustment = adjustments[adjustments.length - 1]

  if (!latestAdjustment || finalIsZero) {
    if (existingItem) {
      await db.delete(accountInventoryOnHand).where(eq(accountInventoryOnHand.id, existingItem.id))
    }

    await db
      .update(accountInventoryAdjustments)
      .set({ inventoryItemId: null })
      .where(and(
        eq(accountInventoryAdjustments.accountId, input.accountId),
        eq(accountInventoryAdjustments.productId, input.productId),
      ))

    return { item: null as AccountInventoryItem | null }
  }

  const updatedByUserId = latestAdjustment.updatedByUserId ?? latestAdjustment.createdByUserId ?? null
  const updatedAt = latestAdjustment.effectiveAt

  let itemId = existingItem?.id ?? null

  if (existingItem) {
    await db.update(accountInventoryOnHand).set({
      sku: product.sku,
      productName: product.name,
      unitType: product.unit,
      casesOnHand: finalCases,
      bottlesOnHand: finalBottles,
      quantityOnHand: finalCases,
      updatedByUserId,
      updatedAt,
    }).where(eq(accountInventoryOnHand.id, existingItem.id))
  } else {
    const [insertedItem] = await db.insert(accountInventoryOnHand).values({
      accountId: input.accountId,
      productId: input.productId,
      sku: product.sku,
      productName: product.name,
      unitType: product.unit,
      casesOnHand: finalCases,
      bottlesOnHand: finalBottles,
      quantityOnHand: finalCases,
      updatedByUserId,
      updatedAt,
    }).returning({ id: accountInventoryOnHand.id })

    itemId = insertedItem.id
  }

  if (itemId) {
    await db
      .update(accountInventoryAdjustments)
      .set({ inventoryItemId: itemId })
      .where(and(
        eq(accountInventoryAdjustments.accountId, input.accountId),
        eq(accountInventoryAdjustments.productId, input.productId),
      ))

    const item = await buildAccountInventoryItem(itemId)
    return { item }
  }

  return { item: null as AccountInventoryItem | null }
}

async function insertAccountInventoryAdjustment(input: {
  accountId: string
  productId: string
  inventoryItemId?: string | null
  sku: string
  productName: string
  changeType: 'manual_add' | 'manual_update' | 'manual_remove' | 'manual_edit'
  deltaCases: number
  deltaBottles: number
  effectiveAt: Date
  notes?: string | null
  actorUserId: string
}) {
  const [adjustment] = await db.insert(accountInventoryAdjustments).values({
    accountId: input.accountId,
    productId: input.productId,
    inventoryItemId: input.inventoryItemId ?? null,
    sku: input.sku,
    productName: input.productName,
    changeType: input.changeType,
    deltaCases: toInventoryFixed(input.deltaCases),
    deltaBottles: toInventoryFixed(input.deltaBottles),
    resultingCasesOnHand: '0.00',
    resultingBottlesOnHand: '0.00',
    effectiveAt: input.effectiveAt,
    notes: input.notes ?? null,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
    updatedAt: new Date(),
  }).returning()

  return adjustment
}

export async function addAccountNote(formData: FormData) {
  const session = await requireRole(...INTERNAL_ACCOUNT_ROLES)
  const accountId = normalizeWhitespace(formData.get('accountId'))
  const noteBody = normalizeWhitespace(formData.get('noteBody'))
  const noteType = normalizeWhitespace(formData.get('noteType')) || 'general_update'
  const isPinned = formData.get('isPinned') === 'on'

  if (!accountId) throw new Error('Account is required.')
  if (!noteBody) throw new Error('Note cannot be empty.')

  const authorRole = getPrimaryRole(session)

  const [account] = await db
    .select({ companyName: customerAccounts.companyName })
    .from(customerAccounts)
    .where(eq(customerAccounts.id, accountId))
    .limit(1)

  if (!account) throw new Error('Account not found.')

  await db.insert(accountNotes).values({
    accountId,
    noteBody,
    noteType,
    authorUserId: session.user.id,
    authorRole,
    isPinned,
  })

  await logActivityEvent({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: 'account_note_added',
    title: 'Note added',
    body: noteBody,
    metadata: {
      noteType,
      isPinned,
      companyName: account.companyName,
    },
  })

  revalidateAccountPaths(accountId)
  return { success: true }
}

export async function updateAccountNote(noteId: string, formData: FormData) {
  const session = await requireRole(...INTERNAL_ACCOUNT_ROLES)
  const noteBody = normalizeWhitespace(formData.get('noteBody'))
  const noteType = normalizeWhitespace(formData.get('noteType')) || 'general_update'
  const isPinned = formData.get('isPinned') === 'on'

  if (!noteBody) return { error: 'Note cannot be empty.' }

  const [existingNote] = await db
    .select()
    .from(accountNotes)
    .where(eq(accountNotes.id, noteId))
    .limit(1)

  if (!existingNote) return { error: 'Note not found.' }

  const roles = session.user.roles ?? []
  const canManageAny = roles.includes('admin') || roles.includes('staff')
  if (!canManageAny && existingNote.authorUserId !== session.user.id) {
    return { error: 'You can only edit your own notes.' }
  }

  await db.update(accountNotes).set({
    noteBody,
    noteType,
    isPinned,
    updatedAt: new Date(),
  }).where(eq(accountNotes.id, noteId))

  await logActivityEvent({
    entityType: 'account',
    entityId: existingNote.accountId,
    actorUserId: session.user.id,
    kind: 'account_note_edited',
    title: 'Note edited',
    body: noteBody,
    metadata: {
      noteId,
      noteType,
      isPinned,
      before: existingNote.noteBody,
      after: noteBody,
    },
  })

  revalidateAccountPaths(existingNote.accountId)
  return { success: true }
}

export async function deleteAccountNote(noteId: string) {
  const session = await requireRole(...INTERNAL_ACCOUNT_ROLES)

  const [existingNote] = await db
    .select()
    .from(accountNotes)
    .where(eq(accountNotes.id, noteId))
    .limit(1)

  if (!existingNote) return { error: 'Note not found.' }

  const roles = session.user.roles ?? []
  const canManageAny = roles.includes('admin') || roles.includes('staff')
  if (!canManageAny && existingNote.authorUserId !== session.user.id) {
    return { error: 'You can only delete your own notes.' }
  }

  await db.delete(accountNotes).where(eq(accountNotes.id, noteId))

  await logActivityEvent({
    entityType: 'account',
    entityId: existingNote.accountId,
    actorUserId: session.user.id,
    kind: 'account_note_deleted',
    title: 'Note deleted',
    body: existingNote.noteBody,
    metadata: {
      noteId,
      noteType: existingNote.noteType,
    },
  })

  revalidateAccountPaths(existingNote.accountId)
  return { success: true }
}

export async function upsertAccountInventoryItem(formData: FormData) {
  const session = await requireRole(...INTERNAL_ACCOUNT_ROLES)
  const accountId = normalizeWhitespace(formData.get('accountId'))
  const productId = normalizeWhitespace(formData.get('productId'))
  const casesInput = normalizeWhitespace(formData.get('casesOnHand')) || '0'
  const bottlesInput = normalizeWhitespace(formData.get('bottlesOnHand')) || '0'
  const inventoryDateInput = normalizeWhitespace(formData.get('inventoryDate'))

  if (!accountId || !productId) return { error: 'Account and product are required.' }

  let cases = 0
  let bottles = 0
  let effectiveAt = new Date()

  try {
    cases = parseInventoryNumber(casesInput, 'Cases')
    bottles = parseInventoryNumber(bottlesInput, 'Bottles')
    effectiveAt = parseInventoryDateInput(inventoryDateInput)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Inventory input is invalid.' }
  }

  const [[account], [product], [existingItem]] = await Promise.all([
    db.select({ companyName: customerAccounts.companyName }).from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1),
    db.select({ id: products.id, sku: products.sku, name: products.name, unit: products.unit }).from(products).where(eq(products.id, productId)).limit(1),
    db
      .select()
      .from(accountInventoryOnHand)
      .where(and(eq(accountInventoryOnHand.accountId, accountId), eq(accountInventoryOnHand.productId, productId)))
      .limit(1),
  ])

  if (!account) return { error: 'Account not found.' }
  if (!product) return { error: 'Product not found.' }

  const beforeCases = roundInventoryValue(Number(existingItem?.casesOnHand ?? '0'))
  const beforeBottles = roundInventoryValue(Number(existingItem?.bottlesOnHand ?? '0'))
  const deltaCases = roundInventoryValue(cases - beforeCases)
  const deltaBottles = roundInventoryValue(bottles - beforeBottles)

  if (deltaCases === 0 && deltaBottles === 0) {
    return { error: 'Enter a changed inventory amount before saving.' }
  }

  const changeType = existingItem ? 'manual_update' : 'manual_add'

  await insertAccountInventoryAdjustment({
    accountId,
    productId,
    inventoryItemId: existingItem?.id ?? null,
    sku: product.sku,
    productName: product.name,
    changeType,
    deltaCases,
    deltaBottles,
    effectiveAt,
    actorUserId: session.user.id,
  })

  await rebuildAccountInventorySnapshot({ accountId, productId })

  await logActivityEvent({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: existingItem ? 'account_inventory_updated' : 'account_inventory_added',
    title: existingItem ? 'Inventory quantity updated' : 'Inventory item added',
    body: existingItem
      ? `${product.name} changed from ${toInventoryFixed(beforeCases)} cases / ${toInventoryFixed(beforeBottles)} bottles to ${toInventoryFixed(cases)} cases / ${toInventoryFixed(bottles)} bottles.`
      : `${product.name} was added with ${toInventoryFixed(cases)} cases and ${toInventoryFixed(bottles)} bottles.`,
    metadata: {
      productId,
      sku: product.sku,
      productName: product.name,
      effectiveAt: effectiveAt.toISOString(),
      before: {
        casesOnHand: toInventoryFixed(beforeCases),
        bottlesOnHand: toInventoryFixed(beforeBottles),
      },
      after: {
        casesOnHand: toInventoryFixed(cases),
        bottlesOnHand: toInventoryFixed(bottles),
      },
    },
  })

  revalidateAccountPaths(accountId)
  return { success: true }
}

export async function removeAccountInventoryItem(itemId: string) {
  const session = await requireRole(...INTERNAL_ACCOUNT_ROLES)
  const [existingItem] = await db
    .select()
    .from(accountInventoryOnHand)
    .where(eq(accountInventoryOnHand.id, itemId))
    .limit(1)

  if (!existingItem) return { error: 'Inventory item not found.' }

  await insertAccountInventoryAdjustment({
    accountId: existingItem.accountId,
    productId: existingItem.productId,
    inventoryItemId: existingItem.id,
    sku: existingItem.sku,
    productName: existingItem.productName,
    changeType: 'manual_remove',
    deltaCases: -roundInventoryValue(Number(existingItem.casesOnHand ?? '0')),
    deltaBottles: -roundInventoryValue(Number(existingItem.bottlesOnHand ?? '0')),
    effectiveAt: new Date(),
    actorUserId: session.user.id,
  })

  await rebuildAccountInventorySnapshot({
    accountId: existingItem.accountId,
    productId: existingItem.productId,
  })

  await logActivityEvent({
    entityType: 'account',
    entityId: existingItem.accountId,
    actorUserId: session.user.id,
    kind: 'account_inventory_removed',
    title: 'Inventory item removed',
    body: `${existingItem.productName} was removed from on-hand inventory.`,
    metadata: {
      productId: existingItem.productId,
      sku: existingItem.sku,
      productName: existingItem.productName,
      casesOnHand: existingItem.casesOnHand,
      bottlesOnHand: existingItem.bottlesOnHand,
    },
  })

  revalidateAccountPaths(existingItem.accountId)
  return { success: true, removedItemId: existingItem.id }
}

export async function updateAccountInventoryAdjustment(formData: FormData) {
  const session = await requireRole('admin')
  const adjustmentId = normalizeWhitespace(formData.get('adjustmentId'))
  const deltaCasesInput = normalizeWhitespace(formData.get('deltaCases')) || '0'
  const deltaBottlesInput = normalizeWhitespace(formData.get('deltaBottles')) || '0'
  const inventoryDateInput = normalizeWhitespace(formData.get('inventoryDate'))
  const notes = normalizeWhitespace(formData.get('notes')) || null

  if (!adjustmentId) return { error: 'Adjustment is required.' }

  let deltaCases = 0
  let deltaBottles = 0
  let effectiveAt = new Date()

  try {
    deltaCases = roundInventoryValue(Number(deltaCasesInput))
    deltaBottles = roundInventoryValue(Number(deltaBottlesInput))
    if (!Number.isFinite(deltaCases) || !Number.isFinite(deltaBottles)) {
      throw new Error('Adjustment values must be valid numbers.')
    }
    effectiveAt = parseInventoryDateInput(inventoryDateInput)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Adjustment is invalid.' }
  }

  if (deltaCases === 0 && deltaBottles === 0) {
    return { error: 'Enter a change amount before saving.' }
  }

  const [existingAdjustment] = await db
    .select()
    .from(accountInventoryAdjustments)
    .where(eq(accountInventoryAdjustments.id, adjustmentId))
    .limit(1)

  if (!existingAdjustment) return { error: 'Inventory change not found.' }

  await db.update(accountInventoryAdjustments).set({
    changeType: 'manual_edit',
    deltaCases: toInventoryFixed(deltaCases),
    deltaBottles: toInventoryFixed(deltaBottles),
    effectiveAt,
    notes,
    updatedByUserId: session.user.id,
    updatedAt: new Date(),
  }).where(eq(accountInventoryAdjustments.id, adjustmentId))

  await rebuildAccountInventorySnapshot({
    accountId: existingAdjustment.accountId,
    productId: existingAdjustment.productId,
  })

  await logActivityEvent({
    entityType: 'account',
    entityId: existingAdjustment.accountId,
    actorUserId: session.user.id,
    kind: 'account_inventory_adjustment_edited',
    title: 'Inventory change edited',
    body: `${existingAdjustment.productName} inventory change was edited.`,
    metadata: {
      adjustmentId,
      productId: existingAdjustment.productId,
      productName: existingAdjustment.productName,
      deltaCases: toInventoryFixed(deltaCases),
      deltaBottles: toInventoryFixed(deltaBottles),
      effectiveAt: effectiveAt.toISOString(),
      notes,
    },
  })

  revalidateAccountPaths(existingAdjustment.accountId)
  return { success: true }
}

export async function deleteAccountInventoryAdjustment(adjustmentId: string) {
  const session = await requireRole('admin')
  const [existingAdjustment] = await db
    .select()
    .from(accountInventoryAdjustments)
    .where(eq(accountInventoryAdjustments.id, adjustmentId))
    .limit(1)

  if (!existingAdjustment) return { error: 'Inventory change not found.' }

  await db.delete(accountInventoryAdjustments).where(eq(accountInventoryAdjustments.id, adjustmentId))

  await rebuildAccountInventorySnapshot({
    accountId: existingAdjustment.accountId,
    productId: existingAdjustment.productId,
  })

  await logActivityEvent({
    entityType: 'account',
    entityId: existingAdjustment.accountId,
    actorUserId: session.user.id,
    kind: 'account_inventory_adjustment_deleted',
    title: 'Inventory change deleted',
    body: `${existingAdjustment.productName} inventory change was deleted.`,
    metadata: {
      adjustmentId,
      productId: existingAdjustment.productId,
      productName: existingAdjustment.productName,
      deltaCases: existingAdjustment.deltaCases,
      deltaBottles: existingAdjustment.deltaBottles,
      effectiveAt: existingAdjustment.effectiveAt.toISOString(),
    },
  })

  revalidateAccountPaths(existingAdjustment.accountId)
  return { success: true }
}

export async function addAccountMedia(formData: FormData) {
  try {
    const accountId = normalizeWhitespace(formData.get('accountId'))
    const mediaUrl = normalizeWhitespace(formData.get('mediaUrl'))
    const mediaType = normalizeWhitespace(formData.get('mediaType')) || 'image'
    const category = normalizeWhitespace(formData.get('category')) || 'store_visit'
    const taggedDateInput = normalizeWhitespace(formData.get('taggedDate'))
    const caption = normalizeWhitespace(formData.get('caption')) || null

    if (!accountId) return { error: 'Account is required.' }
    if (!mediaUrl) return { error: 'Media upload is required.' }
    if (!ACCOUNT_MEDIA_CATEGORIES.has(category)) return { error: 'Choose a valid media category.' }
    if (!taggedDateInput) return { error: 'Choose a tagged date.' }

    const taggedDate = new Date(`${taggedDateInput}T12:00:00.000Z`)
    if (Number.isNaN(taggedDate.getTime())) {
      return { error: 'Tagged date is invalid.' }
    }

    const { session, account } = await requireAccountMediaUploadAccess(accountId)

    try {
      await db.insert(accountMedia).values({
        accountId,
        mediaUrl,
        mediaType,
        category,
        taggedDate,
        caption,
        uploadedByUserId: session.user.id,
      })
    } catch (error) {
      if (isMissingTable(error, 'account_media')) {
        return { error: 'Account media storage is not enabled yet. Run npm run db:push, then try again.' }
      }
      throw error
    }

    await logActivityEvent({
      entityType: 'account',
      entityId: accountId,
      actorUserId: session.user.id,
      kind: 'account_media_added',
      title: 'Account media added',
      body: `${account.companyName} received a new ${category.replaceAll('_', ' ')} media upload.`,
      metadata: {
        mediaType,
        category,
        taggedDate: taggedDate.toISOString(),
        caption,
      },
    })

    revalidateAccountPaths(accountId)
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to save media.' }
  }
}
