'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import {
  accountNotes,
  contacts,
  customerAccounts,
  deliveries,
  deliveryStops,
  drivers,
  orders,
  salesMembers,
  tastingProducts,
  tastings,
  userPreferences,
  users,
} from '@/db/schema'
import { createOrder } from '@/actions/orders'
import { createTask, type CreateTaskInput } from '@/actions/tasks'
import { upsertAccountInventoryItem } from '@/actions/crm-account'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { notify } from '@/lib/notifications/dispatch'

const QUICK_ADD_ROLES = ['admin', 'staff', 'sales_rep', 'sales_manager'] as const

function optionalText(value: string | null | undefined) {
  return value?.trim() || null
}

function revalidateAccount(accountId: string) {
  for (const path of ['/admin/crm', '/staff/crm', '/sales/accounts', `/admin/crm/${accountId}`, `/staff/crm/${accountId}`, `/sales/accounts/${accountId}`]) {
    revalidatePath(path)
  }
}

async function assertQuickAccountAccess(session: Awaited<ReturnType<typeof requireRole>>, accountId: string) {
  const roles = session.user.roles ?? [session.user.role as string]
  const isRepOnly = roles.includes('sales_rep') && !roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
  if (!isRepOnly) return
  const [member] = await db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1)
  const [account] = await db.select({ assignedSalesRepId: customerAccounts.assignedSalesRepId }).from(customerAccounts).where(eq(customerAccounts.id, accountId)).limit(1)
  if (!member || !account || account.assignedSalesRepId !== member.id) throw new Error('You are not assigned to this account.')
}

export async function quickCreateAccount(input: {
  companyName: string
  businessType?: string
  address?: string
  city?: string
  state?: string
  phone?: string
  website?: string
  assignedSalesMemberId?: string
  dealStage?: string
}) {
  try {
    const session = await requireRole(...QUICK_ADD_ROLES)
    const companyName = input.companyName.trim()
    if (!companyName) throw new Error('Account name is required.')
    const roles = session.user.roles ?? [session.user.role as string]
    const canAssign = roles.some((role) => ['admin', 'staff', 'sales_manager'].includes(role))
    let assignedSalesRepId = canAssign ? optionalText(input.assignedSalesMemberId) : null
    if (!assignedSalesRepId && roles.includes('sales_rep')) {
      const [member] = await db.select({ id: salesMembers.id }).from(salesMembers).where(eq(salesMembers.userId, session.user.id)).limit(1)
      assignedSalesRepId = member?.id ?? null
    }

    const [account] = await db.insert(customerAccounts).values({
      companyName,
      businessType: optionalText(input.businessType),
      address: optionalText(input.address),
      city: optionalText(input.city),
      state: optionalText(input.state),
      phone: optionalText(input.phone),
      website: optionalText(input.website),
      assignedSalesRepId,
      dealStage: optionalText(input.dealStage) ?? 'new_lead',
      customerSource: 'manual',
    }).returning({ id: customerAccounts.id, companyName: customerAccounts.companyName })

    await logActivityEvent({
      entityType: 'account', entityId: account.id, actorUserId: session.user.id,
      kind: 'account_created', title: 'Account created', body: `${account.companyName} was added from Quick Add.`,
    })
    revalidateAccount(account.id)
    return { success: true as const, account }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create account.' }
  }
}

export async function quickCreatePerson(input: {
  accountId: string
  firstName: string
  lastName: string
  title?: string
  email?: string
  phone?: string
  notes?: string
}) {
  try {
    const session = await requireRole(...QUICK_ADD_ROLES)
    const name = `${input.firstName.trim()} ${input.lastName.trim()}`.trim()
    if (!input.accountId || !name) throw new Error('Account and person name are required.')
    await assertQuickAccountAccess(session, input.accountId)
    const [account] = await db.select({ companyName: customerAccounts.companyName }).from(customerAccounts).where(eq(customerAccounts.id, input.accountId)).limit(1)
    if (!account) throw new Error('Account not found.')
    const [person] = await db.insert(contacts).values({
      customerId: input.accountId,
      name,
      title: optionalText(input.title),
      email: optionalText(input.email)?.toLowerCase() ?? null,
      phone: optionalText(input.phone),
      phoneType: input.phone ? 'mobile' : null,
      notes: optionalText(input.notes),
    }).returning({ id: contacts.id, name: contacts.name })
    await logActivityEvent({
      entityType: 'account', entityId: input.accountId, actorUserId: session.user.id,
      kind: 'contact_created', title: 'Contact added', body: `${name} was added to ${account.companyName}.`,
      metadata: { contactId: person.id },
    })
    revalidateAccount(input.accountId)
    return { success: true as const, person }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create person.' }
  }
}

export async function quickCreateNote(input: { accountId: string; noteBody: string; noteType?: string }) {
  try {
    const session = await requireRole(...QUICK_ADD_ROLES)
    const noteBody = input.noteBody.trim()
    if (!input.accountId || !noteBody) throw new Error('Account and note are required.')
    await assertQuickAccountAccess(session, input.accountId)
    const [account] = await db.select({ companyName: customerAccounts.companyName }).from(customerAccounts).where(eq(customerAccounts.id, input.accountId)).limit(1)
    if (!account) throw new Error('Account not found.')
    await db.insert(accountNotes).values({
      accountId: input.accountId,
      noteBody,
      noteType: optionalText(input.noteType) ?? 'general_update',
      authorUserId: session.user.id,
      authorRole: session.user.role ?? 'system',
    })
    await logActivityEvent({
      entityType: 'account', entityId: input.accountId, actorUserId: session.user.id,
      kind: 'account_note_added', title: 'Note added', body: noteBody,
      metadata: { noteType: optionalText(input.noteType) ?? 'general_update' },
    })
    revalidateAccount(input.accountId)
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to add note.' }
  }
}

export async function quickAddAccountInventory(input: {
  accountId: string
  productId: string
  bottlesOnHand: number
  inventoryDate: string
}) {
  try {
    const session = await requireRole(...QUICK_ADD_ROLES)
    if (!input.accountId || !input.productId) throw new Error('Account and product are required.')
    await assertQuickAccountAccess(session, input.accountId)

    const formData = new FormData()
    formData.set('accountId', input.accountId)
    formData.set('productId', input.productId)
    formData.set('bottlesOnHand', String(input.bottlesOnHand))
    formData.set('inventoryDate', input.inventoryDate)

    const result = await upsertAccountInventoryItem(formData)
    if (result.error) return result

    revalidateAccount(input.accountId)
    return { success: true as const }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to add account inventory.' }
  }
}

const orderInputSchema = z.object({
  accountId: z.string().uuid(),
  orderedDate: z.string().min(1),
  purchaseUnit: z.enum(['case', 'bottle']).default('case'),
  orderType: z.enum(['paid', 'sample']).default('paid'),
  paymentType: z.enum(['unpaid', 'check', 'cod', 'paid']).default('unpaid'),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().positive() })).min(1),
  isAssisted: z.boolean().default(false),
  assistedByUserId: z.string().uuid().optional().nullable(),
  assistanceType: z.string().optional().nullable(),
  relatedTastingId: z.string().uuid().optional().nullable(),
})

export async function quickCreateOrder(input: z.input<typeof orderInputSchema>) {
  try {
    await requireRole(...QUICK_ADD_ROLES)
    const parsed = orderInputSchema.parse(input)
    const data = new FormData()
    data.set('customerId', parsed.accountId)
    data.set('orderedDate', parsed.orderedDate)
    data.set('purchaseUnit', parsed.purchaseUnit)
    data.set('orderType', parsed.orderType)
    data.set('paymentType', parsed.paymentType)
    data.set('paymentTerms', parsed.paymentTerms || 'PREPAID')
    data.set('notes', parsed.notes || '')
    data.set('items', JSON.stringify(parsed.items))
    data.set('isAssisted', String(parsed.isAssisted))
    if (parsed.assistedByUserId) data.set('assistedByUserId', parsed.assistedByUserId)
    if (parsed.assistanceType) data.set('assistanceType', parsed.assistanceType)
    if (parsed.relatedTastingId) data.set('relatedTastingId', parsed.relatedTastingId)
    return await createOrder(data)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create order.' }
  }
}

export async function quickCreateDelivery(input: {
  accountId: string
  scheduledAt: string
  driverId: string
  orderId?: string | null
  recipientContactId?: string | null
  status?: 'scheduled' | 'in_progress' | 'delivered' | 'failed'
  notes?: string
  items?: Array<{ productId: string; quantity: number; unit: 'case' | 'bottle' }>
}) {
  try {
    const session = await requireRole(...QUICK_ADD_ROLES)
    const scheduledAt = new Date(input.scheduledAt)
    if (!input.accountId || !input.driverId || Number.isNaN(scheduledAt.getTime())) throw new Error('Account, delivery date, and driver are required.')
    await assertQuickAccountAccess(session, input.accountId)
    const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, input.accountId)).limit(1)
    if (!account) throw new Error('Account not found.')
    const [driver] = await db.select({ id: drivers.id, userId: drivers.userId, phone: drivers.phone, name: users.name, email: users.email })
      .from(drivers).innerJoin(users, eq(users.id, drivers.userId)).where(and(eq(drivers.id, input.driverId), eq(drivers.active, true))).limit(1)
    if (!driver) throw new Error('Choose an active driver.')

    if (input.orderId) {
      const [relatedOrder] = await db.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, input.orderId)).limit(1)
      if (!relatedOrder || relatedOrder.customerId !== input.accountId) throw new Error('The related order must belong to the selected account.')
      const existing = await db.select({ id: deliveryStops.id }).from(deliveryStops)
        .innerJoin(deliveries, eq(deliveries.id, deliveryStops.deliveryId))
        .where(and(eq(deliveryStops.orderId, input.orderId), inArray(deliveries.status, ['scheduled', 'in_progress']))).limit(1)
      if (existing[0]) throw new Error('That order already has an active delivery.')
    }

    const runStatus = input.status === 'in_progress' ? 'in_progress' : input.status === 'delivered' ? 'completed' : 'scheduled'
    const stopStatus = input.status === 'delivered' ? 'delivered' : input.status === 'failed' ? 'failed' : 'pending'
    const [delivery] = await db.insert(deliveries).values({
      weekStartDate: input.scheduledAt.slice(0, 10), driverId: input.driverId, status: runStatus,
    }).returning({ id: deliveries.id })
    const fullAddress = [account.address, account.city, account.state, account.zip].filter(Boolean).join(', ')
    await db.insert(deliveryStops).values({
      deliveryId: delivery.id,
      orderId: optionalText(input.orderId),
      customerId: account.id,
      sequenceNumber: 1,
      address: fullAddress || 'Address not on file — please update',
      contactName: account.pocName || account.contactName || account.companyName,
      contactPhone: account.pocPhone || account.phone,
      contactEmail: account.pocEmail || account.businessEmail || account.email,
      status: stopStatus,
      customerStatus: stopStatus === 'delivered' ? 'delivered' : stopStatus === 'failed' ? 'failed' : 'not_started',
      notes: optionalText(input.notes),
      scheduledAt,
      assignedUserId: driver.userId,
      recipientContactId: optionalText(input.recipientContactId),
      deliveredItems: input.items?.filter((item) => item.productId && item.quantity > 0) ?? [],
      completedAt: stopStatus === 'delivered' ? new Date() : null,
      deliveredAt: stopStatus === 'delivered' ? new Date() : null,
    })
    if (input.orderId) {
      await db.update(orders).set({ shippingStatus: stopStatus === 'delivered' ? 'delivered' : stopStatus === 'failed' ? 'issue' : 'scheduled' }).where(eq(orders.id, input.orderId))
    }
    await logActivityEvent({
      entityType: 'delivery', entityId: delivery.id, actorUserId: session.user.id, relatedUserId: driver.userId,
      kind: 'delivery_created', title: 'Delivery scheduled', body: `${account.companyName} delivery scheduled for ${scheduledAt.toLocaleString()}.`,
      metadata: { accountId: account.id, orderId: input.orderId || null },
    })
    const [prefs] = await db.select().from(userPreferences).where(eq(userPreferences.userId, driver.userId)).limit(1)
    if (stopStatus === 'pending') {
      await notify('delivery.driver_assigned', {
        driverName: driver.name,
        driverEmail: prefs?.emailNotificationsEnabled === false ? '' : driver.email,
        driverPhone: prefs?.smsNotificationsEnabled === false ? null : driver.phone,
        weekStartDate: input.scheduledAt.slice(0, 10), stopCount: 1,
        userId: prefs?.inAppNotificationsEnabled === false ? null : driver.userId,
      })
    }
    revalidatePath('/admin/deliveries')
    revalidateAccount(account.id)
    return { success: true as const, deliveryId: delivery.id }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create delivery.' }
  }
}

export async function quickCreateTasting(input: {
  accountId: string
  assignedUserId: string
  scheduledAt: string
  endAt?: string | null
  status?: 'requested' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  location?: string
  notes?: string
  products?: Array<{ productId: string; plannedQuantity: number; startingCases?: number; startingBottles?: number; unitsSold?: number; revenueGenerated?: number }>
  followUpTask?: Omit<CreateTaskInput, 'accountId' | 'tastingId'> | null
}) {
  try {
    const session = await requireRole(...QUICK_ADD_ROLES)
    const scheduledAt = new Date(input.scheduledAt)
    const endAt = input.endAt ? new Date(input.endAt) : null
    if (!input.accountId || !input.assignedUserId || Number.isNaN(scheduledAt.getTime())) throw new Error('Account, assigned rep, and tasting date are required.')
    await assertQuickAccountAccess(session, input.accountId)
    if (endAt && (Number.isNaN(endAt.getTime()) || endAt <= scheduledAt)) throw new Error('Tasting end time must be after the start time.')
    const [account] = await db.select().from(customerAccounts).where(eq(customerAccounts.id, input.accountId)).limit(1)
    if (!account) throw new Error('Account not found.')
    const [assignedUser] = await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, roles: users.roles, active: users.active })
      .from(users).where(eq(users.id, input.assignedUserId)).limit(1)
    if (!assignedUser?.active || !assignedUser.roles.some((role) => ['admin', 'staff', 'sales_rep', 'sales_manager', 'taster'].includes(role))) {
      throw new Error('Choose an eligible active tasting assignee.')
    }

    const locationParts = optionalText(input.location)?.split(',').map((part) => part.trim()) ?? []
    const [tasting] = await db.insert(tastings).values({
      customerId: account.id,
      assignedUserId: assignedUser.id,
      createdByUserId: session.user.id,
      eventName: account.companyName,
      scheduledAt,
      endAt,
      status: input.status ?? 'scheduled',
      storeAddress: locationParts[0] || account.address,
      storeCity: locationParts[1] || account.city,
      storeState: locationParts[2] || account.state,
      storeZip: account.zip,
      storePhone: account.phone,
      notes: optionalText(input.notes),
    }).returning({ id: tastings.id })

    const productRows = (input.products ?? []).filter((item) => item.productId && item.plannedQuantity > 0)
    if (productRows.length) {
      await db.insert(tastingProducts).values(productRows.map((item) => ({
        tastingId: tasting.id,
        productId: item.productId,
        plannedQuantity: item.plannedQuantity.toFixed(2),
        startingInventory: { cases: item.startingCases ?? 0, bottles: item.startingBottles ?? 0 },
        unitsSold: Math.max(0, Math.round(item.unitsSold ?? 0)),
        revenueGenerated: Math.max(0, item.revenueGenerated ?? 0).toFixed(2),
      })))
    }
    await logActivityEvent({
      entityType: 'tasting', entityId: tasting.id, actorUserId: session.user.id, relatedUserId: assignedUser.id,
      kind: 'tasting_created', title: input.status === 'completed' ? 'Tasting logged' : 'Tasting scheduled',
      body: `${account.companyName} tasting ${input.status === 'completed' ? 'completed' : `scheduled for ${scheduledAt.toLocaleString()}`}.`,
      metadata: { accountId: account.id, productCount: productRows.length },
    })

    if (['requested', 'scheduled', 'confirmed'].includes(input.status ?? 'scheduled')) {
      await notify('tasting.taster_assigned', {
        tasterName: assignedUser.name,
        tasterEmail: assignedUser.email,
        tasterPhone: assignedUser.phone,
        storeName: account.companyName,
        storeAddress: [account.address, account.city, account.state, account.zip].filter(Boolean).join(', '),
        scheduledAt, endAt, notes: optionalText(input.notes), tastingId: tasting.id, userId: assignedUser.id,
      })
    }

    let warning: string | undefined
    if (input.followUpTask) {
      const taskResult = await createTask({ ...input.followUpTask, accountId: account.id, tastingId: tasting.id })
      if ('error' in taskResult) warning = `Tasting saved, but follow-up task failed: ${taskResult.error}`
    }
    revalidatePath('/admin/tastings')
    revalidatePath('/staff/tastings')
    revalidatePath('/sales/tastings')
    revalidateAccount(account.id)
    return { success: true as const, tastingId: tasting.id, warning }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to create tasting.' }
  }
}
