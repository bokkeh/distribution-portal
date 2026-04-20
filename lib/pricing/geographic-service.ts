import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { geographicPricingRules } from '@/db/schema'
import { buildCountyKey, normalizeCountyName, normalizeStateCode, resolveGeographicCasePrice, type GeographicPricingRuleInput } from './geographic'
import { normalizeBusinessType } from '@/lib/customers/business-types'

export type AccountPricingContext = {
  accountId: string | null
  businessType: string | null
  state: string | null
  county: string | null
  countyKey?: string | null
}

export async function getPricingRulesForProducts(productIds: string[]) {
  if (!productIds.length) return [] as GeographicPricingRuleInput[]

  const rows = await db
    .select({
      id: geographicPricingRules.id,
      productId: geographicPricingRules.productId,
      stateCode: geographicPricingRules.stateCode,
      countyName: geographicPricingRules.countyName,
      countyKey: geographicPricingRules.countyKey,
      accountId: geographicPricingRules.accountId,
      businessType: geographicPricingRules.businessType,
      ruleType: geographicPricingRules.ruleType,
      minCaseQuantity: geographicPricingRules.minCaseQuantity,
      maxCaseQuantity: geographicPricingRules.maxCaseQuantity,
      casePrice: geographicPricingRules.casePrice,
      effectiveStartDate: geographicPricingRules.effectiveStartDate,
      effectiveEndDate: geographicPricingRules.effectiveEndDate,
      isActive: geographicPricingRules.isActive,
      notes: geographicPricingRules.notes,
      updatedAt: geographicPricingRules.updatedAt,
    })
    .from(geographicPricingRules)
    .where(inArray(geographicPricingRules.productId, productIds))

  return rows
}

export async function getAllPricingRules() {
  return db.select().from(geographicPricingRules)
}

export function normalizeAccountGeography(input: {
  accountId?: string | null | undefined
  businessType?: string | null | undefined
  state: string | null | undefined
  county: string | null | undefined
}) {
  return {
    accountId: input.accountId?.trim() || null,
    businessType: normalizeBusinessType(input.businessType) ?? (input.businessType?.trim() || null),
    state: normalizeStateCode(input.state) ?? (input.state?.trim().toUpperCase() || null),
    county: normalizeCountyName(input.county),
    countyKey: buildCountyKey(input.county),
  }
}

export function resolveProductCasePrice(input: {
  productId: string
  baseCasePrice: string | number
  account: AccountPricingContext
  rules: GeographicPricingRuleInput[]
  asOf?: Date | string
  quantityCases?: number | null
}) {
  return resolveGeographicCasePrice({
    productId: input.productId,
    baseCasePrice: input.baseCasePrice,
    accountId: input.account.accountId,
    businessType: input.account.businessType,
    state: input.account.state,
    county: input.account.county,
    rules: input.rules,
    asOf: input.asOf ?? new Date(),
    quantityCases: input.quantityCases,
  })
}

export async function getPotentialConflictingRules(input: {
  productId: string
  stateCode?: string | null
  ruleType: 'state' | 'county' | 'account' | 'business_type'
  countyKey?: string | null
  accountId?: string | null
  businessType?: string | null
  excludeRuleId?: string | null
}) {
  const rows = await db
    .select()
    .from(geographicPricingRules)
    .where(eq(geographicPricingRules.productId, input.productId))

  return rows.filter((row) => {
    if (row.id === input.excludeRuleId) return false
    if (row.ruleType !== input.ruleType) return false

    switch (input.ruleType) {
      case 'county':
        return row.stateCode === input.stateCode && row.countyKey === input.countyKey
      case 'state':
        return row.stateCode === input.stateCode && row.countyKey === null
      case 'account':
        return row.accountId === input.accountId
      case 'business_type':
        return row.businessType === input.businessType
      default:
        return false
    }
  })
}
