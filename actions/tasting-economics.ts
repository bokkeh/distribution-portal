'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { customerAccounts, orders, tastingEconomicsSettings } from '@/db/schema'
import { logActivityEvent } from '@/lib/activity/log'
import { requireFeature, requireRole } from '@/lib/auth/session'
import { buildTastingDecision } from '@/lib/pull-through/economics'
import { loadAccountIntelligence, resolvePullThroughScope } from '@/lib/pull-through/data'
import type { AccountHealthKind, OrderAttributionKind, TastingDecision } from '@/lib/pull-through/types'

const HEALTH_KINDS: AccountHealthKind[] = ['growth', 'healthy', 'developing', 'tasting_dependent', 'stalled', 'unprofitable']

function revalidateAccount(accountId: string) {
  revalidatePath(`/admin/crm/${accountId}`)
  revalidatePath(`/staff/crm/${accountId}`)
  revalidatePath(`/sales/accounts/${accountId}`)
  revalidatePath('/admin/pull-through')
  revalidatePath('/admin/pull-through/tastings')
}

function parseMoney(value: FormDataEntryValue | null, label: string, min = 0) {
  const parsed = Number(String(value ?? '').trim())
  if (!Number.isFinite(parsed) || parsed < min) throw new Error(`${label} must be a number of at least ${min}.`)
  return Math.round(parsed * 100) / 100
}

/** Global assumptions used by every economics calculation. Admin only. */
export async function updateTastingEconomicsSettings(formData: FormData) {
  const session = await requireRole('admin')

  let contributionPerCase: number
  let defaultTastingCost: number
  let attributionWindowDays: number
  let assistedSalesShare: number
  try {
    contributionPerCase = parseMoney(formData.get('contributionPerCase'), 'Contribution per case')
    defaultTastingCost = parseMoney(formData.get('defaultTastingCost'), 'Typical tasting cost')
    attributionWindowDays = Math.round(parseMoney(formData.get('attributionWindowDays'), 'Attribution window', 1))
    const sharePercent = parseMoney(formData.get('assistedSalesSharePercent'), 'Assisted sales share')
    if (sharePercent > 100) throw new Error('Assisted sales share cannot exceed 100%.')
    assistedSalesShare = Math.round(sharePercent) / 100
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Settings are invalid.' }
  }

  await db
    .insert(tastingEconomicsSettings)
    .values({
      id: 'global',
      contributionPerCase: contributionPerCase.toFixed(2),
      defaultTastingCost: defaultTastingCost.toFixed(2),
      attributionWindowDays,
      assistedSalesShare: assistedSalesShare.toFixed(2),
      updatedByUserId: session.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tastingEconomicsSettings.id,
      set: {
        contributionPerCase: contributionPerCase.toFixed(2),
        defaultTastingCost: defaultTastingCost.toFixed(2),
        attributionWindowDays,
        assistedSalesShare: assistedSalesShare.toFixed(2),
        updatedByUserId: session.user.id,
        updatedAt: new Date(),
      },
    })

  revalidatePath('/admin/pull-through')
  revalidatePath('/admin/pull-through/tastings')
  revalidatePath('/admin/pull-through/tasters')
  return { success: true as const }
}

/** Manually classify an order as organic or tasting-assisted, or clear the override. */
export async function setOrderTastingAttribution(input: {
  orderId: string
  kind: OrderAttributionKind | null
  reason: string | null
}) {
  const session = await requireRole('admin')
  const reason = input.reason?.trim() || null
  if (input.kind && !reason) return { error: 'Give a reason for overriding the classification.' }
  if (input.kind && !['organic', 'assisted'].includes(input.kind)) return { error: 'Unknown classification.' }

  const [order] = await db.select({ id: orders.id, customerId: orders.customerId }).from(orders).where(eq(orders.id, input.orderId)).limit(1)
  if (!order) return { error: 'Order not found.' }

  await db
    .update(orders)
    .set({
      tastingAttributionOverride: input.kind,
      tastingAttributionOverrideReason: input.kind ? reason : null,
      tastingAttributionOverrideByUserId: input.kind ? session.user.id : null,
      tastingAttributionOverrideAt: input.kind ? new Date() : null,
    })
    .where(eq(orders.id, order.id))

  await logActivityEvent({
    entityType: 'account',
    entityId: order.customerId,
    actorUserId: session.user.id,
    kind: 'order_attribution_override',
    title: input.kind ? `Order marked ${input.kind === 'organic' ? 'organic' : 'tasting-assisted'}` : 'Order classification reset to automatic',
    body: reason,
    metadata: { orderId: order.id, kind: input.kind },
  })

  revalidateAccount(order.customerId)
  return { success: true as const }
}

/** Override the automatic account health classification, with a reason; null clears it. */
export async function setAccountHealthOverride(input: { accountId: string; kind: AccountHealthKind | null; reason: string | null }) {
  const session = await requireRole('admin')
  const reason = input.reason?.trim() || null
  if (input.kind && !HEALTH_KINDS.includes(input.kind)) return { error: 'Unknown classification.' }
  if (input.kind && !reason) return { error: 'Give a reason for overriding the classification.' }

  const [account] = await db.select({ id: customerAccounts.id }).from(customerAccounts).where(eq(customerAccounts.id, input.accountId)).limit(1)
  if (!account) return { error: 'Account not found.' }

  await db
    .update(customerAccounts)
    .set({
      healthOverride: input.kind,
      healthOverrideReason: input.kind ? reason : null,
      healthOverrideByUserId: input.kind ? session.user.id : null,
      healthOverrideAt: input.kind ? new Date() : null,
    })
    .where(eq(customerAccounts.id, account.id))

  await logActivityEvent({
    entityType: 'account',
    entityId: account.id,
    actorUserId: session.user.id,
    kind: 'account_health_override',
    title: input.kind ? `Account health set to ${input.kind.replace('_', ' ')}` : 'Account health reset to automatic',
    body: reason,
    metadata: { kind: input.kind },
  })

  revalidateAccount(account.id)
  return { success: true as const }
}

export type SerializedTastingDecision = Omit<TastingDecision, 'facts'> & {
  facts: Omit<TastingDecision['facts'], 'lastOrderAt' | 'lastTastingAt'> & {
    lastOrderAt: string | null
    lastTastingAt: string | null
  }
  accountName: string
  settings: { contributionPerCase: number; defaultTastingCost: number }
}

/**
 * The "should we schedule another tasting?" verdict for an account, for the scheduling
 * form. Serialised so it can cross the server-action boundary.
 */
export async function getTastingDecisionForAccount(accountId: string): Promise<SerializedTastingDecision | { error: string }> {
  const session = await requireFeature('tastings', 'admin', 'staff', 'sales_manager', 'sales_rep')
  const scope = await resolvePullThroughScope(session)
  const intelligence = await loadAccountIntelligence(accountId, scope)
  if (!intelligence) return { error: 'Account not found.' }

  const { row, tastings, settings } = intelligence
  const decision = buildTastingDecision({
    orders: row.orders,
    inventory: row.inventory,
    tastings,
    velocity: row.velocity,
    dependency: row.dependency,
    economics: row.economics,
    health: row.health,
    settings,
    now: new Date(),
  })

  return {
    ...decision,
    facts: {
      ...decision.facts,
      lastOrderAt: decision.facts.lastOrderAt?.toISOString() ?? null,
      lastTastingAt: decision.facts.lastTastingAt?.toISOString() ?? null,
    },
    accountName: row.accountName,
    settings: { contributionPerCase: settings.contributionPerCase, defaultTastingCost: settings.defaultTastingCost },
  }
}
