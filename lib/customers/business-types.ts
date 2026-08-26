const BUSINESS_TYPE_DEFINITIONS = [
  { value: 'Liquor Store', aliases: ['liquor store', 'liquor_store'] },
  { value: 'Restaurant', aliases: ['restaurant'] },
  { value: 'Restaurant Group', aliases: ['restaurant group', 'restaurant_group'] },
  { value: 'Hotel', aliases: ['hotel'] },
  { value: 'Hotel Group', aliases: ['hotel group', 'hotel_group'] },
  { value: 'Venue', aliases: ['venue'] },
  { value: 'Bar', aliases: ['bar'] },
  { value: 'Night Club', aliases: ['night club', 'nightclub', 'night_club'] },
  { value: 'Grocery Store', aliases: ['grocery store', 'grocery_store'] },
  { value: 'Convenience Store', aliases: ['convenience store', 'convenience_store'] },
  { value: 'Country Club', aliases: ['country club', 'country_club'] },
  { value: 'Casino', aliases: ['casino'] },
  { value: 'Wholesaler', aliases: ['wholesaler'] },
  { value: 'Other', aliases: ['other', 'catering', 'catering company', 'catering_company'] },
] as const

export const BUSINESS_TYPE_OPTIONS = BUSINESS_TYPE_DEFINITIONS.map(({ value }) => ({
  value,
  label: value,
}))

const BUSINESS_TYPE_COLORS: Record<string, string> = {
  'Liquor Store': '#211e1c',
  'Restaurant': '#10B981',
  'Restaurant Group': '#059669',
  'Hotel': '#3B82F6',
  'Hotel Group': '#2563EB',
  'Venue': '#8B5CF6',
  'Bar': '#ff5a00',
  'Night Club': '#EC4899',
  'Grocery Store': '#F59E0B',
  'Convenience Store': '#EAB308',
  'Country Club': '#14B8A6',
  'Casino': '#EF4444',
  'Wholesaler': '#6366F1',
  'Other': '#64748B',
}

const UNSPECIFIED_BUSINESS_TYPE_COLOR = '#94A3B8'

export function getBusinessTypeColor(value: string | null | undefined): string {
  const normalized = normalizeBusinessType(value)
  if (!normalized) return UNSPECIFIED_BUSINESS_TYPE_COLOR
  return BUSINESS_TYPE_COLORS[normalized] ?? UNSPECIFIED_BUSINESS_TYPE_COLOR
}

function normalizeBusinessTypeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function normalizeBusinessType(value: string | null | undefined) {
  if (!value) return null
  const normalizedValue = normalizeBusinessTypeKey(value)
  if (!normalizedValue) return null

  const match = BUSINESS_TYPE_DEFINITIONS.find(({ value: canonicalValue, aliases }) =>
    [canonicalValue, ...aliases].some((candidate) => normalizeBusinessTypeKey(candidate) === normalizedValue)
  )

  return match?.value ?? null
}

export function formatBusinessType(value: string | null | undefined) {
  const normalized = normalizeBusinessType(value)
  if (normalized) return normalized
  return value?.trim() ? value.trim().replace(/[_-]+/g, ' ') : 'Not provided'
}

export function isRestaurantStyleBusinessType(value: string | null | undefined) {
  const normalized = normalizeBusinessType(value)
  return normalized === 'Restaurant' || normalized === 'Restaurant Group' || normalized === 'Bar'
}
