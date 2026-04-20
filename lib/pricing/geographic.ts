import { formatBusinessType, normalizeBusinessType } from '@/lib/customers/business-types'

export type GeographicPricingSource = 'account_special' | 'county_override' | 'business_type_price' | 'state_price' | 'default_price'

export type GeographicPricingRuleInput = {
  id: string
  productId: string
  stateCode: string | null
  countyName: string | null
  countyKey: string | null
  accountId: string | null
  businessType: string | null
  ruleType: 'state' | 'county' | 'account' | 'business_type'
  minCaseQuantity: number | null
  maxCaseQuantity: number | null
  casePrice: string
  effectiveStartDate: string | Date
  effectiveEndDate: string | Date | null
  isActive: boolean
  notes?: string | null
  updatedAt?: string | Date
}

export type GeographicPriceResolution = {
  price: number
  source: GeographicPricingSource
  matchedRule: GeographicPricingRuleInput | null
  matchedState: string | null
  matchedCounty: string | null
}

export const US_STATE_OPTIONS = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
] as const

const STATE_NAME_TO_CODE: Record<string, string> = {
  ALABAMA: 'AL',
  ALASKA: 'AK',
  ARIZONA: 'AZ',
  ARKANSAS: 'AR',
  CALIFORNIA: 'CA',
  COLORADO: 'CO',
  CONNECTICUT: 'CT',
  DELAWARE: 'DE',
  FLORIDA: 'FL',
  GEORGIA: 'GA',
  HAWAII: 'HI',
  IDAHO: 'ID',
  ILLINOIS: 'IL',
  INDIANA: 'IN',
  IOWA: 'IA',
  KANSAS: 'KS',
  KENTUCKY: 'KY',
  LOUISIANA: 'LA',
  MAINE: 'ME',
  MARYLAND: 'MD',
  MASSACHUSETTS: 'MA',
  MICHIGAN: 'MI',
  MINNESOTA: 'MN',
  MISSISSIPPI: 'MS',
  MISSOURI: 'MO',
  MONTANA: 'MT',
  NEBRASKA: 'NE',
  NEVADA: 'NV',
  NEW_HAMPSHIRE: 'NH',
  NEW_JERSEY: 'NJ',
  NEW_MEXICO: 'NM',
  NEW_YORK: 'NY',
  NORTH_CAROLINA: 'NC',
  NORTH_DAKOTA: 'ND',
  OHIO: 'OH',
  OKLAHOMA: 'OK',
  OREGON: 'OR',
  PENNSYLVANIA: 'PA',
  RHODE_ISLAND: 'RI',
  SOUTH_CAROLINA: 'SC',
  SOUTH_DAKOTA: 'SD',
  TENNESSEE: 'TN',
  TEXAS: 'TX',
  UTAH: 'UT',
  VERMONT: 'VT',
  VIRGINIA: 'VA',
  WASHINGTON: 'WA',
  WEST_VIRGINIA: 'WV',
  WISCONSIN: 'WI',
  WYOMING: 'WY',
  DISTRICT_OF_COLUMBIA: 'DC',
}

function toKey(value: string) {
  return value
    .trim()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function toIsoDateString(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function compareDateDesc(a: string | null, b: string | null) {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a > b ? -1 : 1
}

export function normalizeStateCode(value: string | null | undefined) {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null
  const compact = raw.replace(/\./g, '').replace(/\s+/g, '_').toUpperCase()
  if (compact.length === 2) return compact
  return STATE_NAME_TO_CODE[compact] ?? null
}

export function normalizeCountyName(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const withoutSuffix = trimmed
    .replace(/\bcounty\b/gi, '')
    .replace(/\bparish\b/gi, '')
    .replace(/\bborough\b/gi, '')
    .replace(/\bcensus area\b/gi, '')
    .replace(/\bmunicipality\b/gi, '')
    .replace(/\bcity and borough\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return withoutSuffix || null
}

export function buildCountyKey(value: string | null | undefined) {
  const county = normalizeCountyName(value)
  return county ? toKey(county) : null
}

export function isRuleActiveOnDate(rule: Pick<GeographicPricingRuleInput, 'isActive' | 'effectiveStartDate' | 'effectiveEndDate'>, asOf: string | Date) {
  if (!rule.isActive) return false
  const asOfIso = toIsoDateString(asOf)
  const startIso = toIsoDateString(rule.effectiveStartDate)
  const endIso = toIsoDateString(rule.effectiveEndDate)
  if (!asOfIso || !startIso) return false
  if (startIso > asOfIso) return false
  if (endIso && endIso < asOfIso) return false
  return true
}

export function dateRangesOverlap(
  leftStart: string | Date,
  leftEnd: string | Date | null,
  rightStart: string | Date,
  rightEnd: string | Date | null
) {
  const leftStartIso = toIsoDateString(leftStart)
  const leftEndIso = toIsoDateString(leftEnd) ?? '9999-12-31T23:59:59.999Z'
  const rightStartIso = toIsoDateString(rightStart)
  const rightEndIso = toIsoDateString(rightEnd) ?? '9999-12-31T23:59:59.999Z'
  if (!leftStartIso || !rightStartIso) return false
  return leftStartIso <= rightEndIso && rightStartIso <= leftEndIso
}

export function normalizeCaseQuantity(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const quantity = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  return Math.floor(quantity)
}

export function quantityRangeMatches(
  rule: Pick<GeographicPricingRuleInput, 'minCaseQuantity' | 'maxCaseQuantity'>,
  quantity: number | null | undefined
) {
  const normalizedQuantity = normalizeCaseQuantity(quantity)
  const min = normalizeCaseQuantity(rule.minCaseQuantity)
  const max = normalizeCaseQuantity(rule.maxCaseQuantity)
  if (normalizedQuantity === null) return min === null && max === null
  if (min !== null && normalizedQuantity < min) return false
  if (max !== null && normalizedQuantity > max) return false
  return true
}

export function quantityRangesConflict(
  left: Pick<GeographicPricingRuleInput, 'minCaseQuantity' | 'maxCaseQuantity'>,
  right: Pick<GeographicPricingRuleInput, 'minCaseQuantity' | 'maxCaseQuantity'>
) {
  const leftMin = normalizeCaseQuantity(left.minCaseQuantity)
  const leftMax = normalizeCaseQuantity(left.maxCaseQuantity)
  const rightMin = normalizeCaseQuantity(right.minCaseQuantity)
  const rightMax = normalizeCaseQuantity(right.maxCaseQuantity)
  const leftIsGeneric = leftMin === null && leftMax === null
  const rightIsGeneric = rightMin === null && rightMax === null

  if (leftIsGeneric || rightIsGeneric) return leftIsGeneric && rightIsGeneric

  const normalizedLeftMax = leftMax ?? Number.POSITIVE_INFINITY
  const normalizedRightMax = rightMax ?? Number.POSITIVE_INFINITY

  return leftMin! <= normalizedRightMax && rightMin! <= normalizedLeftMax
}

export function quantityRangesCanStack(
  left: Pick<GeographicPricingRuleInput, 'minCaseQuantity' | 'maxCaseQuantity'>,
  right: Pick<GeographicPricingRuleInput, 'minCaseQuantity' | 'maxCaseQuantity'>
) {
  const leftMin = normalizeCaseQuantity(left.minCaseQuantity)
  const leftMax = normalizeCaseQuantity(left.maxCaseQuantity)
  const rightMin = normalizeCaseQuantity(right.minCaseQuantity)
  const rightMax = normalizeCaseQuantity(right.maxCaseQuantity)

  return leftMin !== null && rightMin !== null && leftMax === null && rightMax === null && leftMin !== rightMin
}

export function describeQuantityRange(rule: Pick<GeographicPricingRuleInput, 'minCaseQuantity' | 'maxCaseQuantity'>) {
  const min = normalizeCaseQuantity(rule.minCaseQuantity)
  const max = normalizeCaseQuantity(rule.maxCaseQuantity)
  if (min === null && max === null) return 'All quantities'
  if (min !== null && max !== null) return `${min}-${max} cases`
  if (min !== null) return `${min}+ cases`
  return `Up to ${max} cases`
}

function sortRules(rules: GeographicPricingRuleInput[]) {
  return [...rules].sort((a, b) => {
    const aMin = normalizeCaseQuantity(a.minCaseQuantity) ?? 0
    const bMin = normalizeCaseQuantity(b.minCaseQuantity) ?? 0
    if (aMin !== bMin) return bMin - aMin

    const aMax = normalizeCaseQuantity(a.maxCaseQuantity) ?? Number.POSITIVE_INFINITY
    const bMax = normalizeCaseQuantity(b.maxCaseQuantity) ?? Number.POSITIVE_INFINITY
    if (aMax !== bMax) return aMax - bMax

    const startDiff = compareDateDesc(toIsoDateString(a.effectiveStartDate), toIsoDateString(b.effectiveStartDate))
    if (startDiff !== 0) return startDiff
    const updatedDiff = compareDateDesc(toIsoDateString(a.updatedAt ?? null), toIsoDateString(b.updatedAt ?? null))
    if (updatedDiff !== 0) return updatedDiff
    return a.id.localeCompare(b.id)
  })
}

export function resolveGeographicCasePrice(input: {
  baseCasePrice: string | number
  productId: string
  accountId?: string | null
  businessType?: string | null
  state: string | null | undefined
  county: string | null | undefined
  rules: GeographicPricingRuleInput[]
  asOf: string | Date
  quantityCases?: number | null
}): GeographicPriceResolution {
  const basePrice = typeof input.baseCasePrice === 'number' ? input.baseCasePrice : Number(input.baseCasePrice)
  const normalizedAccountId = input.accountId?.trim() || null
  const normalizedBusinessType = normalizeBusinessType(input.businessType)
  const normalizedState = normalizeStateCode(input.state)
  const countyKey = buildCountyKey(input.county)
  const relevantRules = sortRules(
    input.rules.filter((rule) => rule.productId === input.productId && isRuleActiveOnDate(rule, input.asOf))
  )

  function findBestRule(candidates: GeographicPricingRuleInput[]) {
    const quantity = normalizeCaseQuantity(input.quantityCases)
    if (quantity === null) {
      return candidates.find((rule) => normalizeCaseQuantity(rule.minCaseQuantity) === null && normalizeCaseQuantity(rule.maxCaseQuantity) === null)
    }

    const quantitySpecific = candidates.find((rule) => {
      const hasSpecificRange =
        normalizeCaseQuantity(rule.minCaseQuantity) !== null ||
        normalizeCaseQuantity(rule.maxCaseQuantity) !== null
      return hasSpecificRange && quantityRangeMatches(rule, quantity)
    })

    if (quantitySpecific) return quantitySpecific

    return candidates.find((rule) => normalizeCaseQuantity(rule.minCaseQuantity) === null && normalizeCaseQuantity(rule.maxCaseQuantity) === null)
  }

  if (normalizedAccountId) {
    const accountRule = findBestRule(relevantRules.filter((rule) =>
      rule.ruleType === 'account' &&
      rule.accountId === normalizedAccountId
    ))

    if (accountRule) {
      return {
        price: Number(accountRule.casePrice),
        source: 'account_special',
        matchedRule: accountRule,
        matchedState: normalizedState,
        matchedCounty: normalizeCountyName(input.county),
      }
    }
  }

  if (normalizedState && countyKey) {
    const countyRule = findBestRule(relevantRules.filter((rule) =>
      rule.ruleType === 'county' &&
      normalizeStateCode(rule.stateCode) === normalizedState &&
      rule.countyKey === countyKey
    ))

    if (countyRule) {
      return {
        price: Number(countyRule.casePrice),
        source: 'county_override',
        matchedRule: countyRule,
        matchedState: normalizedState,
        matchedCounty: normalizeCountyName(input.county),
      }
    }
  }

  if (normalizedBusinessType) {
    const businessTypeRule = findBestRule(relevantRules.filter((rule) =>
      rule.ruleType === 'business_type' &&
      normalizeBusinessType(rule.businessType) === normalizedBusinessType
    ))

    if (businessTypeRule) {
      return {
        price: Number(businessTypeRule.casePrice),
        source: 'business_type_price',
        matchedRule: businessTypeRule,
        matchedState: normalizedState,
        matchedCounty: normalizeCountyName(input.county),
      }
    }
  }

  if (normalizedState) {
    const stateRule = findBestRule(relevantRules.filter((rule) =>
      rule.ruleType === 'state' &&
      normalizeStateCode(rule.stateCode) === normalizedState
    ))

    if (stateRule) {
      return {
        price: Number(stateRule.casePrice),
        source: 'state_price',
        matchedRule: stateRule,
        matchedState: normalizedState,
        matchedCounty: normalizeCountyName(input.county),
      }
    }
  }

  return {
    price: basePrice,
    source: 'default_price',
    matchedRule: null,
    matchedState: normalizedState,
    matchedCounty: normalizeCountyName(input.county),
  }
}

export function describePricingSource(source: GeographicPricingSource) {
  switch (source) {
    case 'account_special':
      return 'Special account pricing'
    case 'county_override':
      return 'County override'
    case 'business_type_price':
      return 'Business type pricing'
    case 'state_price':
      return 'State rule'
    default:
      return 'Default price'
  }
}

export function describePricingRuleType(ruleType: GeographicPricingRuleInput['ruleType']) {
  switch (ruleType) {
    case 'account':
      return 'Special pricing'
    case 'business_type':
      return 'Business type pricing'
    case 'county':
      return 'County override'
    default:
      return 'State price'
  }
}

export function describePricingRuleScope(rule: Pick<GeographicPricingRuleInput, 'ruleType' | 'stateCode' | 'countyName' | 'businessType'> & { accountName?: string | null }) {
  switch (rule.ruleType) {
    case 'account':
      return rule.accountName?.trim() || 'Specific account'
    case 'business_type':
      return formatBusinessType(rule.businessType)
    case 'county':
      return `${rule.countyName ?? 'Unknown county'}, ${rule.stateCode ?? ''}`.trim().replace(/^,\s*/, '')
    default:
      return rule.stateCode ?? 'No state'
  }
}
