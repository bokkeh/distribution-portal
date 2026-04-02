'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { accountInventoryOnHand, accountNotes, customerAccounts, products } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'

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

  const [[account], [product], [existingItem]] = await Promise.all([
    db.select({ companyName: customerAccounts.companyName }).from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1),
    db.select({ id: products.id, sku: products.sku, name: products.name, unit: products.unit }).from(products).where(eq(products.id, productId)).limit(1),
    db.select().from(accountInventoryOnHand).where(and(eq(accountInventoryOnHand.accountId, accountId), eq(accountInventoryOnHand.productId, productId))).limit(1),
  ])

  if (!account) return { error: 'Account not found.' }
  if (!product) return { error: 'Product not found.' }

  const casesValue = cases.toFixed(2)
  const bottlesValue = bottles.toFixed(2)

  if (existingItem) {
    await db.update(accountInventoryOnHand).set({
      sku: product.sku,
      productName: product.name,
      unitType: product.unit,
      casesOnHand: casesValue,
      bottlesOnHand: bottlesValue,
      quantityOnHand: casesValue,
      updatedByUserId: session.user.id,
      updatedAt: new Date(),
    }).where(eq(accountInventoryOnHand.id, existingItem.id))

    await logActivityEvent({
      entityType: 'account',
      entityId: accountId,
      actorUserId: session.user.id,
      kind: 'account_inventory_updated',
      title: 'Inventory quantity updated',
      body: `${product.name} changed from ${existingItem.casesOnHand} cases / ${existingItem.bottlesOnHand} bottles to ${casesValue} cases / ${bottlesValue} bottles.`,
      metadata: {
        productId,
        sku: product.sku,
        productName: product.name,
        before: {
          casesOnHand: existingItem.casesOnHand,
          bottlesOnHand: existingItem.bottlesOnHand,
        },
        after: {
          casesOnHand: casesValue,
          bottlesOnHand: bottlesValue,
        },
      },
    })
  } else {
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
    })

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
  }

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
  return { success: true }
}
