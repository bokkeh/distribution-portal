export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

// Order due-date guidance. Existing manually entered invoice dates remain authoritative.
export function getDeliveryDueDate(deliveryDate: string | null, terms: string | null): string | null {
  if (!deliveryDate || !isValidDateOnly(deliveryDate)) return null
  const match = /^NET(7|10|15|30|45|60|90)$/.exec(terms ?? '')
  const days = match ? Number(match[1]) : terms === '2/10_NET30' ? 30 : ['COD', 'DUE_ON_RECEIPT'].includes(terms ?? '') ? 0 : null
  if (days === null) return null
  const date = new Date(`${deliveryDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
