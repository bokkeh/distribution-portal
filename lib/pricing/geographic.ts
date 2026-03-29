export type GeographicPricingSource = 'county_override' | 'state_price' | 'default_price'

export type GeographicPricingRuleInput = {
  id: string
  productId: string
  stateCode: string
  countyName: string | null
  countyKey: string | null
  ruleType: 'state' | 'county'
  casePrice: string
  effectiveStartDate: string | Date
  effectiveEndDate: string | Date | null
  isActive: boolean
  updatedAt?: string | Date
}

export type GeographicPriceResolution = {
  price: number
  source: GeographicPricingSource
  matchedRule: GeographicPricingRuleInput | null
  matchedState: string | null
  matchedCounty: string | null
}

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

function sortRules(rules: GeographicPricingRuleInput[]) {
  return [...rules].sort((a, b) => {
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
  state: string | null | undefined
  county: string | null | undefined
  rules: GeographicPricingRuleInput[]
  asOf: string | Date
}): GeographicPriceResolution {
  const basePrice = typeof input.baseCasePrice === 'number' ? input.baseCasePrice : Number(input.baseCasePrice)
  const normalizedState = normalizeStateCode(input.state)
  const countyKey = buildCountyKey(input.county)
  const relevantRules = sortRules(
    input.rules.filter((rule) => rule.productId === input.productId && isRuleActiveOnDate(rule, input.asOf))
  )

  if (normalizedState && countyKey) {
    const countyRule = relevantRules.find((rule) =>
      rule.ruleType === 'county' &&
      normalizeStateCode(rule.stateCode) === normalizedState &&
      rule.countyKey === countyKey
    )

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

  if (normalizedState) {
    const stateRule = relevantRules.find((rule) =>
      rule.ruleType === 'state' &&
      normalizeStateCode(rule.stateCode) === normalizedState
    )

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
    case 'county_override':
      return 'County override'
    case 'state_price':
      return 'State rule'
    default:
      return 'Default price'
  }
}
