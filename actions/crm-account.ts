'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { accountInventoryOnHand, accountNotes, customerAccounts, products } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import type { AccountInventoryHistoryEvent, AccountInventoryItem } from '@/lib/crm/account-detail-data'

const INTERNAL_ACCOUNT_ROLES = ['admin', 'staff', 'driver', 'taster', 'sales_rep', 'sales_manager'] as const

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

function isMissingInventoryColumn(error: unknown) {
  const message = getErrorText(error)
  return message.includes('account_inventory_on_hand') && message.includes('column')
}

async function getInventoryOnHandColumns() {
  const rows = await db.execute(sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'account_inventory_on_hand'
  `)

  return new Set(
    rows.rows
      .map((row) => {
        const value = row as Record<string, unknown>
        return typeof value.column_name === 'string' ? value.column_name : null
      })
      .filter((columnName): columnName is string => Boolean(columnName))
  )
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
  const casesInput = normalizeWhitespace(formData.get('casesOnHand'))
  const bottlesInput = normalizeWhitespace(formData.get('bottlesOnHand'))

  if (!accountId || !productId) return { error: 'Account and product are required.' }

  const cases = Number(casesInput || '0')
  const bottles = Number(bottlesInput || '0')
  if (!Number.isFinite(cases) || cases < 0 || !Number.isFinite(bottles) || bottles < 0) {
    return { error: 'Cases and bottles must be zero or greater.' }
  }

  const [[account], [product]] = await Promise.all([
    db.select({ companyName: customerAccounts.companyName }).from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1),
    db.select({ id: products.id, sku: products.sku, name: products.name, unit: products.unit }).from(products).where(eq(products.id, productId)).limit(1),
  ])

  if (!account) return { error: 'Account not found.' }
  if (!product) return { error: 'Product not found.' }

  const casesValue = cases.toFixed(2)
  const bottlesValue = bottles.toFixed(2)
  const updatedAt = new Date()
  const updatedByName = session.user.name ?? null
  const updatedByRole = getPrimaryRole(session)

  let existingItem:
    | (typeof accountInventoryOnHand.$inferSelect & { casesOnHand?: string; bottlesOnHand?: string })
    | undefined

  try {
    ;[existingItem] = await db
      .select()
      .from(accountInventoryOnHand)
      .where(and(eq(accountInventoryOnHand.accountId, accountId), eq(accountInventoryOnHand.productId, productId)))
      .limit(1)
  } catch (error) {
    if (!isMissingInventoryColumn(error)) throw error

    const legacyRows = await db.execute(sql`
      select
        id,
        account_id,
        product_id,
        sku,
        product_name,
        unit_type,
        quantity_on_hand,
        updated_by_user_id,
        created_at,
        updated_at
      from account_inventory_on_hand
      where account_id = ${accountId}::uuid
        and product_id = ${productId}::uuid
      limit 1
    `)

    const row = legacyRows.rows[0] as Record<string, unknown> | undefined
    if (row) {
      existingItem = {
        id: String(row.id),
        accountId: String(row.account_id),
        productId: String(row.product_id),
        sku: String(row.sku ?? ''),
        productName: String(row.product_name ?? ''),
        unitType: typeof row.unit_type === 'string' ? row.unit_type : null,
        quantityOnHand: String(row.quantity_on_hand ?? '0'),
        casesOnHand: String(row.quantity_on_hand ?? '0'),
        bottlesOnHand: '0',
        updatedByUserId: typeof row.updated_by_user_id === 'string' ? row.updated_by_user_id : null,
        createdAt: row.created_at instanceof Date ? row.created_at : new Date(),
        updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(),
      } as typeof accountInventoryOnHand.$inferSelect & { casesOnHand?: string; bottlesOnHand?: string }
    }
  }

  const beforeCases = existingItem?.casesOnHand ?? existingItem?.quantityOnHand ?? '0'
  const beforeBottles = existingItem?.bottlesOnHand ?? '0'

  if (existingItem) {
    try {
      await db.update(accountInventoryOnHand).set({
        sku: product.sku,
        productName: product.name,
        unitType: product.unit,
        casesOnHand: casesValue,
        bottlesOnHand: bottlesValue,
        quantityOnHand: casesValue,
        updatedByUserId: session.user.id,
        updatedAt,
      }).where(eq(accountInventoryOnHand.id, existingItem.id))
    } catch (error) {
      if (!isMissingInventoryColumn(error)) throw error

      if (bottles > 0) {
        return { error: 'Bottle tracking is not enabled in this database yet. Run npm run db:push, then try again.' }
      }

      await db.execute(sql`
        update account_inventory_on_hand
        set
          sku = ${product.sku},
          product_name = ${product.name},
          unit_type = ${product.unit},
          quantity_on_hand = ${casesValue},
          updated_by_user_id = ${session.user.id}::uuid,
          updated_at = now()
        where id = ${existingItem.id}::uuid
      `)
    }

    await logActivityEvent({
      entityType: 'account',
      entityId: accountId,
      actorUserId: session.user.id,
      kind: 'account_inventory_updated',
      title: 'Inventory quantity updated',
      body: `${product.name} changed from ${beforeCases} cases / ${beforeBottles} bottles to ${casesValue} cases / ${bottlesValue} bottles.`,
      metadata: {
        productId,
        sku: product.sku,
        productName: product.name,
        before: {
          casesOnHand: beforeCases,
          bottlesOnHand: beforeBottles,
        },
        after: {
          casesOnHand: casesValue,
          bottlesOnHand: bottlesValue,
        },
      },
    })

    const item: AccountInventoryItem = {
      id: existingItem.id,
      accountId,
      productId,
      sku: product.sku,
      productName: product.name,
      unitType: product.unit,
      casesOnHand: casesValue,
      bottlesOnHand: bottlesValue,
      updatedByUserId: session.user.id,
      updatedByName,
      updatedByRole,
      updatedAt,
    }
    const historyEvent: AccountInventoryHistoryEvent = {
      id: `${existingItem.id}-${updatedAt.getTime()}`,
      kind: 'account_inventory_updated',
      title: 'Inventory quantity updated',
      createdAt: updatedAt,
      productId,
      productName: product.name,
      deltaCases: Number(casesValue) - Number(beforeCases),
      deltaBottles: Number(bottlesValue) - Number(beforeBottles),
    }

    revalidateAccountPaths(accountId)
    return { success: true, item, historyEvent }
  } else {
    try {
      await db.insert(accountInventoryOnHand).values({
        accountId,
        productId,
        sku: product.sku,
        productName: product.name,
        unitType: product.unit,
        casesOnHand: casesValue,
        bottlesOnHand: bottlesValue,
        quantityOnHand: casesValue,
        updatedByUserId: session.user.id,
        updatedAt,
      })
    } catch (error) {
      if (!isMissingInventoryColumn(error)) throw error

      if (bottles > 0) {
        return { error: 'Bottle tracking is not enabled in this database yet. Run npm run db:push, then try again.' }
      }

      await db.execute(sql`
        insert into account_inventory_on_hand (
          account_id,
          product_id,
          sku,
          product_name,
          unit_type,
          quantity_on_hand,
          updated_by_user_id
        ) values (
          ${accountId}::uuid,
          ${productId}::uuid,
          ${product.sku},
          ${product.name},
          ${product.unit},
          ${casesValue},
          ${session.user.id}::uuid
        )
      `)
    }

    const [insertedItem] = await db
      .select({ id: accountInventoryOnHand.id })
      .from(accountInventoryOnHand)
      .where(and(eq(accountInventoryOnHand.accountId, accountId), eq(accountInventoryOnHand.productId, productId)))
      .limit(1)

    await logActivityEvent({
      entityType: 'account',
      entityId: accountId,
      actorUserId: session.user.id,
      kind: 'account_inventory_added',
      title: 'Inventory item added',
      body: `${product.name} was added with ${casesValue} cases and ${bottlesValue} bottles.`,
      metadata: {
        productId,
        sku: product.sku,
        productName: product.name,
        casesOnHand: casesValue,
        bottlesOnHand: bottlesValue,
      },
    })

    const item: AccountInventoryItem = {
      id: insertedItem?.id ?? `${accountId}-${productId}`,
      accountId,
      productId,
      sku: product.sku,
      productName: product.name,
      unitType: product.unit,
      casesOnHand: casesValue,
      bottlesOnHand: bottlesValue,
      updatedByUserId: session.user.id,
      updatedByName,
      updatedByRole,
      updatedAt,
    }
    const historyEvent: AccountInventoryHistoryEvent = {
      id: `${productId}-${updatedAt.getTime()}`,
      kind: 'account_inventory_added',
      title: 'Inventory item added',
      createdAt: updatedAt,
      productId,
      productName: product.name,
      deltaCases: Number(casesValue),
      deltaBottles: Number(bottlesValue),
    }

    revalidateAccountPaths(accountId)
    return { success: true, item, historyEvent }
  }
}

export async function removeAccountInventoryItem(itemId: string) {
  const session = await requireRole(...INTERNAL_ACCOUNT_ROLES)
  const [existingItem] = await db
    .select()
    .from(accountInventoryOnHand)
    .where(eq(accountInventoryOnHand.id, itemId))
    .limit(1)

  if (!existingItem) return { error: 'Inventory item not found.' }

  await db.delete(accountInventoryOnHand).where(eq(accountInventoryOnHand.id, itemId))

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
  const historyEvent: AccountInventoryHistoryEvent = {
    id: `${existingItem.id}-removed-${Date.now()}`,
    kind: 'account_inventory_removed',
    title: 'Inventory item removed',
    createdAt: new Date(),
    productId: existingItem.productId,
    productName: existingItem.productName,
    deltaCases: -Number(existingItem.casesOnHand ?? '0'),
    deltaBottles: -Number(existingItem.bottlesOnHand ?? '0'),
  }

  return { success: true, removedItemId: existingItem.id, historyEvent }
}
