import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { geographicPricingRules } from '@/db/schema'
import { buildCountyKey, normalizeCountyName, normalizeStateCode, resolveGeographicCasePrice, type GeographicPricingRuleInput } from './geographic'

export type AccountPricingContext = {
  state: string | null
  county: string | null
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
      ruleType: geographicPricingRules.ruleType,
      casePrice: geographicPricingRules.casePrice,
      effectiveStartDate: geographicPricingRules.effectiveStartDate,
      effectiveEndDate: geographicPricingRules.effectiveEndDate,
      isActive: geographicPricingRules.isActive,
      updatedAt: geographicPricingRules.updatedAt,
    })
    .from(geographicPricingRules)
    .where(inArray(geographicPricingRules.productId, productIds))

  return rows
}

export async function getAllPricingRules() {
  return db.select().from(geographicPricingRules)
}

export function normalizeAccountGeography(input: { state: string | null | undefined; county: string | null | undefined }) {
  return {
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
}) {
  return resolveGeographicCasePrice({
    productId: input.productId,
    baseCasePrice: input.baseCasePrice,
    state: input.account.state,
    county: input.account.county,
    rules: input.rules,
    asOf: input.asOf ?? new Date(),
  })
}

export async function getPotentialConflictingRules(input: {
  productId: string
  stateCode: string
  ruleType: 'state' | 'county'
  countyKey: string | null
  excludeRuleId?: string | null
}) {
  const rows = await db
    .select()
    .from(geographicPricingRules)
    .where(
      and(
        eq(geographicPricingRules.productId, input.productId),
        eq(geographicPricingRules.stateCode, input.stateCode),
        eq(geographicPricingRules.ruleType, input.ruleType),
        input.ruleType === 'county'
          ? eq(geographicPricingRules.countyKey, input.countyKey ?? '')
          : isNull(geographicPricingRules.countyKey)
      )
    )

  return rows.filter((row) => row.id !== input.excludeRuleId)
}
