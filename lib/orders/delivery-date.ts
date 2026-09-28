export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function getNetTermsDays(terms: string | null): number | null {
  const match = /^NET(7|10|15|30|45|60|90)$/.exec(terms ?? '')
  if (match) return Number(match[1])
  if (terms === '2/10_NET30') return 30
  if (['COD', 'DUE_ON_RECEIPT'].includes(terms ?? '')) return 0
  return null
}

// Order due-date guidance. Existing manually entered invoice dates remain authoritative.
export function getDeliveryDueDate(deliveryDate: string | null, terms: string | null): string | null {
  if (!deliveryDate || !isValidDateOnly(deliveryDate)) return null
  const days = getNetTermsDays(terms)
  if (days === null) return null
  const date = new Date(`${deliveryDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Short display copy for the order/invoice UI: "Due 15 days after delivery", "Due on delivery", or a fallback when no delivery date/known terms exist yet. */
export function describeDueDateGuidance(deliveryDate: string | null, terms: string | null): string {
  const days = getNetTermsDays(terms)
  if (days === null) {
    return deliveryDate ? 'No delivery-based due date for these payment terms.' : 'Due date will calculate when delivery is confirmed.'
  }
  if (!deliveryDate) {
    return days === 0 ? 'Due on delivery. Due date will calculate when delivery is confirmed.' : `Due ${days} days after delivery. Due date will calculate when delivery is confirmed.`
  }
  const dueDate = getDeliveryDueDate(deliveryDate, terms)
  if (days === 0) return `Due on delivery (${dueDate}).`
  return `Due ${days} days after delivery (${dueDate}).`
}
