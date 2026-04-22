export const CUSTOMER_SEGMENT_VALUES = ['b2b_wholesale', 'b2c_consumer'] as const

export type CustomerSegment = (typeof CUSTOMER_SEGMENT_VALUES)[number]

export const CUSTOMER_SOURCE_VALUES = ['manual', 'hubspot', 'wisher_vodka_csv'] as const

export type CustomerSource = (typeof CUSTOMER_SOURCE_VALUES)[number]

export const CRM_ACCOUNT_FILTER_VALUES = ['all', 'b2b', 'b2c', 'wisher'] as const

export type CRMAccountFilter = (typeof CRM_ACCOUNT_FILTER_VALUES)[number]

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  b2b_wholesale: 'B2B',
  b2c_consumer: 'B2C',
}

export const CUSTOMER_SOURCE_LABELS: Record<CustomerSource, string> = {
  manual: 'Manual',
  hubspot: 'HubSpot',
  wisher_vodka_csv: 'Wisher CSV',
}

export const CRM_ACCOUNT_FILTERS: Array<{ value: CRMAccountFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'b2b', label: 'B2B' },
  { value: 'b2c', label: 'B2C' },
  { value: 'wisher', label: 'Wisher' },
]

export function normalizeCustomerSegment(value: string | null | undefined): CustomerSegment {
  return value === 'b2c_consumer' ? 'b2c_consumer' : 'b2b_wholesale'
}

export function normalizeCustomerSource(value: string | null | undefined): CustomerSource | null {
  if (value === 'manual' || value === 'hubspot' || value === 'wisher_vodka_csv') return value
  return null
}

export function normalizeCRMAccountFilter(value: string | null | undefined): CRMAccountFilter {
  if (value === 'all' || value === 'b2c' || value === 'wisher') return value
  return 'b2b'
}

export function getCustomerSegmentLabel(value: string | null | undefined): string {
  return CUSTOMER_SEGMENT_LABELS[normalizeCustomerSegment(value)]
}

export function getCustomerSourceLabel(value: string | null | undefined): string {
  const source = normalizeCustomerSource(value)
  return source ? CUSTOMER_SOURCE_LABELS[source] : 'Unknown'
}
