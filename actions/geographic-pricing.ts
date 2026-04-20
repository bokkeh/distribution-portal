'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { customerAccounts, geographicPricingRules } from '@/db/schema'
import { requireRole } from '@/lib/auth/session'
import { logActivityEvent } from '@/lib/activity/log'
import { normalizeBusinessType } from '@/lib/customers/business-types'
import { buildCountyKey, dateRangesOverlap, describePricingRuleScope, describePricingRuleType, describeQuantityRange, normalizeCaseQuantity, normalizeCountyName, normalizeStateCode, quantityRangesCanStack, quantityRangesConflict } from '@/lib/pricing/geographic'
import { getPotentialConflictingRules } from '@/lib/pricing/geographic-service'

type UpsertPricingRuleInput = {
  id?: string | null
  productId: string
  stateCode?: string | null
  countyName?: string | null
  accountId?: string | null
  businessType?: string | null
  ruleType: 'state' | 'county' | 'account' | 'business_type'
  minCaseQuantity?: string | null
  maxCaseQuantity?: string | null
  casePrice: string
  effectiveStartDate: string
  effectiveEndDate?: string | null
  isActive: boolean
  notes?: string | null
}

function revalidatePricingPaths() {
  revalidatePath('/admin/pricing')
  revalidatePath('/admin/crm')
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
  const accountId = input.accountId?.trim() || null
  const businessType = normalizeBusinessType(input.businessType)
  const minCaseQuantity = normalizeCaseQuantity(input.minCaseQuantity)
  const maxCaseQuantity = normalizeCaseQuantity(input.maxCaseQuantity)
  const casePrice = Number(input.casePrice)
  const effectiveStartDate = input.effectiveStartDate ? new Date(input.effectiveStartDate) : null
  const effectiveEndDate = input.effectiveEndDate ? new Date(input.effectiveEndDate) : null
  const notes = toNullableString(input.notes)

  if (!productId) return { error: 'Product is required.' }

  if ((input.ruleType === 'state' || input.ruleType === 'county') && !stateCode) {
    return { error: 'A valid 2-letter state code is required for geographic rules.' }
  }
  if (input.ruleType === 'county' && !countyName) return { error: 'County is required for county override rules.' }
  if (input.ruleType === 'account' && !accountId) return { error: 'Select an account for special pricing.' }
  if (input.ruleType === 'business_type' && !businessType) return { error: 'Select a business type for this pricing rule.' }
  if (input.ruleType !== 'county' && input.countyName?.trim()) return { error: 'Only county overrides can include a county.' }
  if (input.minCaseQuantity && minCaseQuantity === null) return { error: 'Minimum quantity must be a whole number greater than zero.' }
  if (input.maxCaseQuantity && maxCaseQuantity === null) return { error: 'Maximum quantity must be a whole number greater than zero.' }
  if (minCaseQuantity !== null && maxCaseQuantity !== null && maxCaseQuantity < minCaseQuantity) {
    return { error: 'Maximum quantity must be greater than or equal to minimum quantity.' }
  }
  if (!Number.isFinite(casePrice) || casePrice <= 0) return { error: 'Case price must be greater than zero.' }
  if (!effectiveStartDate || Number.isNaN(effectiveStartDate.getTime())) return { error: 'Effective start date is required.' }
  if (effectiveEndDate && Number.isNaN(effectiveEndDate.getTime())) return { error: 'Effective end date is invalid.' }
  if (effectiveEndDate && effectiveEndDate < effectiveStartDate) return { error: 'Effective end date must be on or after the start date.' }

  let accountName: string | null = null
  if (accountId) {
    const [account] = await db
      .select({ id: customerAccounts.id, companyName: customerAccounts.companyName })
      .from(customerAccounts)
      .where(eq(customerAccounts.id, accountId))
      .limit(1)

    if (!account) return { error: 'Selected account was not found.' }
    accountName = account.companyName
  }

  const existingConflicts = await getPotentialConflictingRules({
    productId,
    stateCode,
    ruleType: input.ruleType,
    countyKey: input.ruleType === 'county' ? countyKey : null,
    accountId: input.ruleType === 'account' ? accountId : null,
    businessType: input.ruleType === 'business_type' ? businessType : null,
    excludeRuleId: input.id ?? null,
  })

  const nextValues = {
    productId,
    stateCode: input.ruleType === 'state' || input.ruleType === 'county' ? stateCode : null,
    countyName: input.ruleType === 'county' ? countyName : null,
    countyKey: input.ruleType === 'county' ? countyKey : null,
    accountId: input.ruleType === 'account' ? accountId : null,
    businessType: input.ruleType === 'business_type' ? businessType : null,
    ruleType: input.ruleType,
    minCaseQuantity,
    maxCaseQuantity,
    casePrice: casePrice.toFixed(2),
    effectiveStartDate,
    effectiveEndDate,
    isActive: input.isActive,
    notes,
    updatedBy: session.user.id,
    updatedAt: new Date(),
  }

  if (input.isActive) {
    const overlappingGeneric = existingConflicts.find((rule) =>
      rule.isActive &&
      dateRangesOverlap(rule.effectiveStartDate, rule.effectiveEndDate, effectiveStartDate, effectiveEndDate) &&
      quantityRangesConflict(rule, { minCaseQuantity, maxCaseQuantity }) &&
      !quantityRangesCanStack(rule, { minCaseQuantity, maxCaseQuantity })
    )

    if (overlappingGeneric) {
      return {
        error: `An active ${describePricingRuleType(input.ruleType).toLowerCase()} already overlaps this product, date range, and quantity tier.`,
      }
    }
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
      title: 'Pricing rule updated',
      body: `${describePricingRuleScope({ ...updatedRule, accountName })} pricing was updated for ${describeQuantityRange(updatedRule)}.`,
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
    title: 'Pricing rule created',
    body: `${describePricingRuleScope({ ...createdRule, accountName })} pricing was created for ${describeQuantityRange(createdRule)}.`,
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
    title: 'Pricing rule deactivated',
    body: `${describePricingRuleScope(updatedRule)} pricing was deactivated for ${describeQuantityRange(updatedRule)}.`,
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
    title: 'Pricing rule deleted',
    body: `${describePricingRuleScope(existingRule)} pricing was deleted for ${describeQuantityRange(existingRule)}.`,
    metadata: {
      previousValue: existingRule,
      newValue: null,
    },
  })

  revalidatePricingPaths()
  return { success: true }
}
