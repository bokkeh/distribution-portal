import { z } from 'zod'
const optionalMoney = z.union([z.literal(''), z.coerce.number().finite().nonnegative().max(999999999)]).transform(v => v === '' ? null : v)
export const historicalInput = z.object({
  accountId: z.uuid(), id: z.union([z.literal(''), z.uuid()]).optional(), revision: z.coerce.number().int().nonnegative().default(0),
  orderDate: z.iso.date(), productId: z.union([z.literal(''), z.uuid()]), productNameFreeform: z.string().trim().max(500),
  cases: z.coerce.number().finite().nonnegative().max(9999999), bottles: z.coerce.number().finite().nonnegative().max(9999999),
  orderValue: optionalMoney, caseUnitPrice: optionalMoney, bottleUnitPrice: optionalMoney,
  source: z.enum(['imported', 'manual_historical', 'legacy_system']), externalReference: z.string().trim().max(500),
  paymentStatus: z.enum(['', 'unpaid', 'paid', 'failed', 'canceled']), fulfillmentStatus: z.enum(['', 'pending', 'confirmed', 'fulfilled', 'cancelled']),
  notes: z.string().max(10000), duplicateReason: z.string().trim().max(2000).default(''),
}).refine(v => v.cases > 0 || v.bottles > 0, 'Enter a positive case or bottle quantity.').refine(v => v.productId || v.productNameFreeform, 'Choose a product or enter its name.')
export function historicalFingerprintParts(v: z.infer<typeof historicalInput>) {
  return JSON.stringify([v.accountId, v.orderDate, v.productId || v.productNameFreeform.toLowerCase(), v.cases.toFixed(2), v.bottles.toFixed(2), v.orderValue?.toFixed(2) ?? null, v.externalReference.toLowerCase()])
}
