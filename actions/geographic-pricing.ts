'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { geographicPricingRules } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { dateRangesOverlap, buildCountyKey, normalizeCountyName, normalizeStateCode } from '@/lib/pricing/geographic'
import { getPotentialConflictingRules } from '@/lib/pricing/geographic-service'

type UpsertPricingRuleInput = {
  id?: string | null
  productId: string
  stateCode: string
  countyName?: string | null
  ruleType: 'state' | 'county'
  casePrice: string
  effectiveStartDate: string
  effectiveEndDate?: string | null
  isActive: boolean
  notes?: string | null
}

function revalidatePricingPaths() {
  revalidatePath('/admin/pricing')
  revalidatePath('/admin/orders/new')
  revalidatePath('/staff/orders/new')
  revalidatePath('/customer/products')
  revalidatePath('/customer/cart')
  revalidatePath('/customer/checkout')
}

function toNullableString(value: string | null | undefined) {
  const next = value?.trim()
  return next ? next : null
}

export async function upsertGeographicPricingRule(input: UpsertPricingRuleInput) {
  const session = await requireRole('admin')

  const productId = input.productId?.trim()
  const stateCode = normalizeStateCode(input.stateCode)
  const countyName = normalizeCountyName(input.countyName)
  const countyKey = buildCountyKey(input.countyName)
  const casePrice = Number(input.casePrice)
  const effectiveStartDate = input.effectiveStartDate ? new Date(input.effectiveStartDate) : null
  const effectiveEndDate = input.effectiveEndDate ? new Date(input.effectiveEndDate) : null
  const notes = toNullableString(input.notes)

  if (!productId) return { error: 'Product is required.' }
  if (!stateCode) return { error: 'A valid 2-letter state code is required.' }
  if (input.ruleType === 'county' && !countyName) return { error: 'County is required for county override rules.' }
  if (input.ruleType === 'state' && input.countyName?.trim()) return { error: 'State-level rules cannot include a county.' }
  if (!Number.isFinite(casePrice) || casePrice <= 0) return { error: 'Case price must be greater than zero.' }
  if (!effectiveStartDate || Number.isNaN(effectiveStartDate.getTime())) return { error: 'Effective start date is required.' }
  if (effectiveEndDate && Number.isNaN(effectiveEndDate.getTime())) return { error: 'Effective end date is invalid.' }
  if (effectiveEndDate && effectiveEndDate < effectiveStartDate) return { error: 'Effective end date must be on or after the start date.' }

  const existingConflicts = await getPotentialConflictingRules({
    productId,
    stateCode,
    ruleType: input.ruleType,
    countyKey: input.ruleType === 'county' ? countyKey : null,
    excludeRuleId: input.id ?? null,
  })

  if (input.isActive) {
    const overlapping = existingConflicts.find((rule) =>
      rule.isActive &&
      dateRangesOverlap(rule.effectiveStartDate, rule.effectiveEndDate, effectiveStartDate, effectiveEndDate)
    )

    if (overlapping) {
      return {
        error: `An active ${input.ruleType === 'county' ? 'county' : 'state'} rule already overlaps this product and date range.`,
      }
    }
  }

  const nextValues = {
    productId,
    stateCode,
    countyName: input.ruleType === 'county' ? countyName : null,
    countyKey: input.ruleType === 'county' ? countyKey : null,
    ruleType: input.ruleType,
    casePrice: casePrice.toFixed(2),
    effectiveStartDate,
    effectiveEndDate,
    isActive: input.isActive,
    notes,
    updatedBy: session.user.id,
    updatedAt: new Date(),
  }

  if (input.id) {
    const [existingRule] = await db
      .select()
      .from(geographicPricingRules)
      .where(eq(geographicPricingRules.id, input.id))
      .limit(1)

    if (!existingRule) return { error: 'Pricing rule not found.' }

    const [updatedRule] = await db
      .update(geographicPricingRules)
      .set(nextValues)
      .where(eq(geographicPricingRules.id, input.id))
      .returning()

    await logActivityEvent({
      entityType: 'pricing_rule',
      entityId: updatedRule.id,
      actorUserId: session.user.id,
      kind: 'pricing_rule_updated',
      title: 'Geographic pricing rule updated',
      body: `${updatedRule.ruleType === 'county' ? updatedRule.countyName : updatedRule.stateCode} pricing was updated.`,
      metadata: {
        previousValue: existingRule,
        newValue: updatedRule,
      },
    })

    revalidatePricingPaths()
    return { success: true, ruleId: updatedRule.id }
  }

  const [createdRule] = await db
    .insert(geographicPricingRules)
    .values({
      ...nextValues,
      createdBy: session.user.id,
    })
    .returning()

  await logActivityEvent({
    entityType: 'pricing_rule',
    entityId: createdRule.id,
    actorUserId: session.user.id,
    kind: 'pricing_rule_created',
    title: 'Geographic pricing rule created',
    body: `${createdRule.ruleType === 'county' ? createdRule.countyName : createdRule.stateCode} pricing was created.`,
    metadata: {
      previousValue: null,
      newValue: createdRule,
    },
  })

  revalidatePricingPaths()
  return { success: true, ruleId: createdRule.id }
}

export async function deactivateGeographicPricingRule(ruleId: string) {
  const session = await requireRole('admin')

  const [existingRule] = await db
    .select()
    .from(geographicPricingRules)
    .where(eq(geographicPricingRules.id, ruleId))
    .limit(1)

  if (!existingRule) return { error: 'Pricing rule not found.' }

  const [updatedRule] = await db
    .update(geographicPricingRules)
    .set({
      isActive: false,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(geographicPricingRules.id, ruleId))
    .returning()

  await logActivityEvent({
    entityType: 'pricing_rule',
    entityId: updatedRule.id,
    actorUserId: session.user.id,
    kind: 'pricing_rule_deactivated',
    title: 'Geographic pricing rule deactivated',
    body: `${updatedRule.ruleType === 'county' ? updatedRule.countyName : updatedRule.stateCode} pricing was deactivated.`,
    metadata: {
      previousValue: existingRule,
      newValue: updatedRule,
    },
  })

  revalidatePricingPaths()
  return { success: true }
}

export async function deleteGeographicPricingRule(ruleId: string) {
  const session = await requireRole('admin')

  const [existingRule] = await db
    .select()
    .from(geographicPricingRules)
    .where(eq(geographicPricingRules.id, ruleId))
    .limit(1)

  if (!existingRule) return { error: 'Pricing rule not found.' }

  await db.delete(geographicPricingRules).where(eq(geographicPricingRules.id, ruleId))

  await logActivityEvent({
    entityType: 'pricing_rule',
    entityId: existingRule.id,
    actorUserId: session.user.id,
    kind: 'pricing_rule_deleted',
    title: 'Geographic pricing rule deleted',
    body: `${existingRule.ruleType === 'county' ? existingRule.countyName : existingRule.stateCode} pricing was deleted.`,
    metadata: {
      previousValue: existingRule,
      newValue: null,
    },
  })

  revalidatePricingPaths()
  return { success: true }
}
