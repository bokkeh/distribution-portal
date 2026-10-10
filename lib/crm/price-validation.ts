import { z } from 'zod'
import { parseDateTimeInTimeZone } from '../tastings/time'

export const priceObservationSchema = z.object({
  requestId: z.string().uuid(),
  accountId: z.string().uuid(), productId: z.string().uuid(),
  price: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, 'Enter a price of zero or more, with up to two decimals.'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code, e.g. USD.'),
  priceType: z.enum(['regular', 'promotional']),
  observedOn: z.string(), observedTime: z.string(), timeZone: z.string(),
  productSize: z.string().trim().max(100), notes: z.string().trim().max(5000),
}).superRefine((input, ctx) => {
  if (!Number.isFinite(parseDateTimeInTimeZone(input.observedOn, input.observedTime, input.timeZone).getTime())) ctx.addIssue({ code: 'custom', message: 'Choose a valid observation date/time in the venue timezone.', path: ['observedOn'] })
  try { new Intl.NumberFormat('en-US', { style: 'currency', currency: input.currency }) } catch { ctx.addIssue({ code: 'custom', message: 'Use a valid currency code.', path: ['currency'] }) }
})

export function parseObservationSelection(bottles: string, price: string) {
  const inventory = bottles.trim() !== ''
  const pricing = price.trim() !== ''
  if (!inventory && !pricing) return { error: 'Enter an inventory count, a price, or both.' }
  if (inventory && (!/^\d+$/.test(bottles.trim()) || !Number.isSafeInteger(Number(bottles)))) return { error: 'Enter a whole-number inventory count of zero or more.' }
  return { inventory, pricing }
}
