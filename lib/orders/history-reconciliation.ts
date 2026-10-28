export type HistoricalPurchaseLine = {
  id: string; accountId: string; orderDate: Date; productId: string | null; productNameFreeform: string | null
  cases: string; bottles: string; orderValue: string | null; externalReference: string | null
  duplicateReviewReason?: string | null
  fulfillmentStatus: string | null; bottlesPerCase: number | null
}
export type LivePurchaseLine = { accountId: string; orderId: string; date: string; productId: string; cases: number; bottles: number; value: number }
const signature = (a: string, d: string, p: string, c: number, b: number, value: number | null) => JSON.stringify([a, d, p, c.toFixed(2), b.toFixed(2), value == null ? null : value.toFixed(2)])
/** Exact overlaps are excluded conservatively and remain inspectable in the original history. */
export function reconcileHistoricalPurchases(history: HistoricalPurchaseLine[], live: LivePurchaseLine[]) {
  const seen = new Set(live.map(r => signature(r.accountId, r.date, r.productId, r.cases, r.bottles, r.value)))
  const included: HistoricalPurchaseLine[] = []
  const excluded: { id: string; reason: string }[] = []
  for (const row of history) {
    if (row.fulfillmentStatus === 'cancelled') continue
    const key = signature(row.accountId, row.orderDate.toISOString().slice(0, 10), row.productId ?? row.productNameFreeform?.toLowerCase().trim() ?? '', Number(row.cases), Number(row.bottles), row.orderValue == null ? null : Number(row.orderValue))
    if (seen.has(key) && !row.duplicateReviewReason) { excluded.push({ id: row.id, reason: 'Exact date/product/quantity/value overlap with another recorded purchase; excluded pending review.' }); continue }
    seen.add(key); included.push(row)
  }
  return { included, excluded }
}
export function groupHistoricalPurchases(rows: HistoricalPurchaseLine[]) {
  const grouped = new Map<string, { id: string; accountId: string; date: Date; cases: number; bottles: number; total: number; revenueKnown: boolean }>()
  for (const row of rows) {
    // A source reference groups multi-SKU rows into one purchase. Legacy rows without one retain their identity.
    const key = row.externalReference ? `${row.accountId}:${row.orderDate.toISOString().slice(0,10)}:${row.externalReference.toLowerCase()}` : row.id
    const group = grouped.get(key) ?? { id: row.id, accountId: row.accountId, date: row.orderDate, cases: 0, bottles: 0, total: 0, revenueKnown: true }
    const pack = row.bottlesPerCase && row.bottlesPerCase > 0 ? row.bottlesPerCase : 12
    group.cases += Number(row.cases) + Number(row.bottles) / pack
    group.bottles += Number(row.cases) * pack + Number(row.bottles)
    group.total += row.orderValue == null ? 0 : Number(row.orderValue)
    group.revenueKnown &&= row.orderValue != null
    grouped.set(key, group)
  }
  return [...grouped.values()]
}
