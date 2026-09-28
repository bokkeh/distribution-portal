type Location = { address: string | null; city: string | null; state: string | null; zip: string | null }

export function getAccountTastingLocations(account: Location & { additionalLocations?: string | null }): Location[] {
  const locations: Location[] = [{ address: account.address, city: account.city, state: account.state, zip: account.zip }]
  if (!account.additionalLocations) return locations
  try {
    const additional: unknown = JSON.parse(account.additionalLocations)
    if (!Array.isArray(additional)) return locations
    for (const value of additional) {
      if (!value || typeof value !== 'object' || typeof value.address !== 'string' || !value.address.trim()) continue
      const text = (key: string) => typeof value[key] === 'string' ? value[key].trim() || null : null
      locations.push({ address: text('address'), city: text('city'), state: text('state'), zip: text('zip') })
    }
  } catch { /* Legacy malformed data should not prevent booking the primary location. */ }
  return locations
}
