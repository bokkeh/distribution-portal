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
