'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { accountInventoryAdjustments, accountInventoryOnHand, accountMedia, accountNotes, customerAccounts, products, salesMembers } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import {
  insertAccountInventoryAdjustment,
  rebuildAccountInventorySnapshot,
  roundInventoryValue,
  toInventoryFixed,
} from '@/lib/crm/account-inventory-ledger'

const INTERNAL_ACCOUNT_ROLES = ['admin', 'staff', 'driver', 'taster', 'sales_rep', 'sales_manager'] as const
const ACCOUNT_MEDIA_UPLOAD_ROLES = ['admin', 'sales_rep', 'sales_manager'] as const
const ACCOUNT_MEDIA_CATEGORIES = new Set(['tasting', 'store_visit', 'delivery', 'customers', 'employees', 'events'])
const ACCOUNT_MEDIA_TYPES = new Set(['image', 'pdf', 'word', 'spreadsheet', 'presentation', 'document'])

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

function parseAccountNoteDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Activity date is invalid.')
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day, 12))
  if (
    Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error('Activity date is invalid.')
  }

  return parsed
}

export async function addAccountNote(formData: FormData) {
  const session = await requireRole(...INTERNAL_ACCOUNT_ROLES)
  const accountId = normalizeWhitespace(formData.get('accountId'))
  const noteBody = normalizeWhitespace(formData.get('noteBody'))
  const noteType = normalizeWhitespace(formData.get('noteType')) || 'general_update'
  const occurredAtInput = normalizeWhitespace(formData.get('occurredAt'))
  const isPinned = formData.get('isPinned') === 'on'

  if (!accountId) throw new Error('Account is required.')
  if (!noteBody) throw new Error('Note cannot be empty.')

  const occurredAt = parseAccountNoteDateInput(occurredAtInput)

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
    occurredAt,
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
      occurredAt: occurredAt.toISOString(),
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
  const occurredAtInput = normalizeWhitespace(formData.get('occurredAt'))
  const isPinned = formData.get('isPinned') === 'on'

  if (!noteBody) return { error: 'Note cannot be empty.' }

  let occurredAt: Date
  try {
    occurredAt = parseAccountNoteDateInput(occurredAtInput)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Activity date is invalid.' }
  }

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
    occurredAt,
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
      occurredAt: occurredAt.toISOString(),
      previousOccurredAt: existingNote.occurredAt.toISOString(),
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

  let legacyCases = 0
  let enteredBottles = 0
  let effectiveAt = new Date()

  try {
    legacyCases = parseInventoryNumber(casesInput, 'Cases')
    enteredBottles = parseInventoryNumber(bottlesInput, 'Bottles')
    effectiveAt = parseInventoryDateInput(inventoryDateInput)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Inventory input is invalid.' }
  }

  const [[account], [product], [existingItem]] = await Promise.all([
    db.select({ companyName: customerAccounts.companyName }).from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1),
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        bottlesPerCase: products.bottlesPerCase,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1),
    db
      .select()
      .from(accountInventoryOnHand)
      .where(and(eq(accountInventoryOnHand.accountId, accountId), eq(accountInventoryOnHand.productId, productId)))
      .limit(1),
  ])

  if (!account) return { error: 'Account not found.' }
  if (!product) return { error: 'Product not found.' }

  const beforeBottles = roundInventoryValue(
    Number(existingItem?.bottlesOnHand ?? '0')
      + Number(existingItem?.casesOnHand ?? '0') * product.bottlesPerCase,
  )
  // casesOnHand is accepted only for compatibility with an older deployed form.
  // Every new write is normalized and persisted as bottles.
  const bottles = roundInventoryValue(enteredBottles + legacyCases * product.bottlesPerCase)
  const deltaBottles = roundInventoryValue(bottles - beforeBottles)
  const dateChanged = existingItem
    ? effectiveAt.toISOString().slice(0, 10) !== new Date(existingItem.updatedAt).toISOString().slice(0, 10)
    : true

  if (deltaBottles === 0 && !dateChanged) {
    return { error: 'Enter a changed inventory amount or date before saving.' }
  }

  const changeType = existingItem ? 'manual_update' : 'manual_add'

  await insertAccountInventoryAdjustment({
    accountId,
    productId,
    inventoryItemId: existingItem?.id ?? null,
    sku: product.sku,
    productName: product.name,
    changeType,
    deltaBottles,
    recordedBottlesOnHand: bottles,
    effectiveAt,
    actorUserId: session.user.id,
  })

  await rebuildAccountInventorySnapshot({ accountId, productId })

  await logActivityEvent({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: existingItem ? 'account_inventory_updated' : 'account_inventory_added',
    title: existingItem ? (deltaBottles === 0 ? 'Inventory date corrected' : 'Inventory quantity updated') : 'Inventory item added',
    body: existingItem
      ? (deltaBottles === 0
        ? `${product.name} count date was corrected to ${effectiveAt.toISOString().slice(0, 10)} with no change to quantity.`
        : `${product.name} changed from ${toInventoryFixed(beforeBottles)} bottles to ${toInventoryFixed(bottles)} bottles.`)
      : `${product.name} was added with ${toInventoryFixed(bottles)} bottles.`,
    metadata: {
      productId,
      sku: product.sku,
      productName: product.name,
      effectiveAt: effectiveAt.toISOString(),
      before: {
        bottlesOnHand: toInventoryFixed(beforeBottles),
      },
      after: {
        bottlesOnHand: toInventoryFixed(bottles),
      },
    },
  })

  revalidateAccountPaths(accountId)
  return { success: true }
}

export async function addAccountInventoryHistoryEntry(formData: FormData) {
  const session = await requireRole(...INTERNAL_ACCOUNT_ROLES)
  const accountId = normalizeWhitespace(formData.get('accountId'))
  const productId = normalizeWhitespace(formData.get('productId'))
  const bottlesInput = normalizeWhitespace(formData.get('bottlesOnHand')) || '0'
  const inventoryDateInput = normalizeWhitespace(formData.get('inventoryDate'))
  const notes = normalizeWhitespace(formData.get('notes')) || null

  if (!accountId || !productId) return { error: 'Account and product are required.' }

  let bottles = 0
  let effectiveAt = new Date()

  try {
    bottles = parseInventoryNumber(bottlesInput, 'Bottles')
    effectiveAt = parseInventoryDateInput(inventoryDateInput)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Inventory log entry is invalid.' }
  }

  const [[account], [product], [existingItem]] = await Promise.all([
    db
      .select({ companyName: customerAccounts.companyName })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, accountId))
      .limit(1),
    db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1),
    db
      .select({ id: accountInventoryOnHand.id })
      .from(accountInventoryOnHand)
      .where(and(
        eq(accountInventoryOnHand.accountId, accountId),
        eq(accountInventoryOnHand.productId, productId),
      ))
      .limit(1),
  ])

  if (!account) return { error: 'Account not found.' }
  if (!product) return { error: 'Product not found.' }

  await insertAccountInventoryAdjustment({
    accountId,
    productId,
    inventoryItemId: existingItem?.id ?? null,
    sku: product.sku,
    productName: product.name,
    changeType: existingItem ? 'manual_update' : 'manual_add',
    deltaBottles: 0,
    recordedBottlesOnHand: bottles,
    effectiveAt,
    notes,
    actorUserId: session.user.id,
  })

  await rebuildAccountInventorySnapshot({ accountId, productId })

  await logActivityEvent({
    entityType: 'account',
    entityId: accountId,
    actorUserId: session.user.id,
    kind: 'account_inventory_count_recorded',
    title: 'Inventory count recorded',
    body: `${product.name} was recorded at ${toInventoryFixed(bottles)} bottles for ${effectiveAt.toISOString().slice(0, 10)}.`,
    metadata: {
      productId,
      sku: product.sku,
      productName: product.name,
      bottlesOnHand: toInventoryFixed(bottles),
      effectiveAt: effectiveAt.toISOString(),
      notes,
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

  const [product] = await db
    .select({ bottlesPerCase: products.bottlesPerCase })
    .from(products)
    .where(eq(products.id, existingItem.productId))
    .limit(1)

  if (!product) return { error: 'Product not found.' }

  await insertAccountInventoryAdjustment({
    accountId: existingItem.accountId,
    productId: existingItem.productId,
    inventoryItemId: existingItem.id,
    sku: existingItem.sku,
    productName: existingItem.productName,
    changeType: 'manual_remove',
    deltaBottles: -roundInventoryValue(
      Number(existingItem.bottlesOnHand ?? '0')
        + Number(existingItem.casesOnHand ?? '0') * product.bottlesPerCase,
    ),
    recordedBottlesOnHand: 0,
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
      bottlesOnHand: toInventoryFixed(
        Number(existingItem.bottlesOnHand ?? '0')
          + Number(existingItem.casesOnHand ?? '0') * product.bottlesPerCase,
      ),
    },
  })

  revalidateAccountPaths(existingItem.accountId)
  return { success: true, removedItemId: existingItem.id }
}

export async function updateAccountInventoryAdjustment(formData: FormData) {
  const session = await requireRole('admin')
  const adjustmentId = normalizeWhitespace(formData.get('adjustmentId'))
  const recordedBottlesInput = normalizeWhitespace(formData.get('recordedBottlesOnHand'))
  const inventoryDateInput = normalizeWhitespace(formData.get('inventoryDate'))
  const notes = normalizeWhitespace(formData.get('notes')) || null

  if (!adjustmentId) return { error: 'Adjustment is required.' }

  const [existingAdjustment] = await db
    .select()
    .from(accountInventoryAdjustments)
    .where(eq(accountInventoryAdjustments.id, adjustmentId))
    .limit(1)

  if (!existingAdjustment) return { error: 'Inventory change not found.' }

  const isAdditiveEvent = existingAdjustment.changeType === 'order_fulfillment'
  let recordedBottlesOnHand: number | null = null
  let effectiveAt = new Date()

  try {
    if (!isAdditiveEvent) {
      if (!recordedBottlesInput) throw new Error('Bottles counted is required.')
      recordedBottlesOnHand = parseInventoryNumber(recordedBottlesInput, 'Bottles counted')
    }
    effectiveAt = parseInventoryDateInput(inventoryDateInput)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Inventory entry is invalid.' }
  }

  const dateChanged = effectiveAt.toISOString().slice(0, 10) !== new Date(existingAdjustment.effectiveAt).toISOString().slice(0, 10)
  const notesChanged = notes !== (existingAdjustment.notes ?? null)
  const recordedCountChanged = !isAdditiveEvent
    && toInventoryFixed(recordedBottlesOnHand ?? 0) !== toInventoryFixed(Number(existingAdjustment.recordedBottlesOnHand ?? 0))

  if (!recordedCountChanged && !dateChanged && !notesChanged) {
    return { error: 'Change the bottle count, date, or note before saving.' }
  }

  await db.update(accountInventoryAdjustments).set({
    changeType: isAdditiveEvent ? 'order_fulfillment' : 'manual_edit',
    deltaCases: '0.00',
    recordedBottlesOnHand: isAdditiveEvent ? null : toInventoryFixed(recordedBottlesOnHand ?? 0),
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
      recordedBottlesOnHand: isAdditiveEvent ? null : toInventoryFixed(recordedBottlesOnHand ?? 0),
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
    if (!ACCOUNT_MEDIA_TYPES.has(mediaType)) return { error: 'Choose a valid media type.' }
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
