import { z } from 'zod'

export const fieldDocumentSchema = z.object({
  requestId: z.uuid(), accountId: z.uuid(), kind: z.enum(['order', 'invoice']),
  paymentMethod: z.enum(['check', 'cod', 'stripe']),
  email: z.union([z.email().max(254), z.literal('')]).default(''), notes: z.string().trim().max(2000).default(''),
  items: z.array(z.object({ productId: z.uuid(), quantity: z.number().int().positive().max(10000) })).max(30).default([]),
  description: z.string().trim().max(200).default(''),
  amount: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).optional(),
  tax: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).default('0'),
  quotedTotal: z.string().optional(),
}).superRefine((input, ctx) => {
  if (input.kind === 'order' && (!input.items.length || new Set(input.items.map(item => item.productId)).size !== input.items.length)) ctx.addIssue({ code: 'custom', message: 'Choose products and whole case quantities without duplicate products.' })
  if (input.kind === 'invoice' && (!input.description || !input.amount || Number(input.amount) <= 0)) ctx.addIssue({ code: 'custom', message: 'Enter an invoice description and a positive amount.' })
})
export type FieldDocumentInput = z.input<typeof fieldDocumentSchema>

export function fieldLoginReturn(value: string | null | undefined) {
  return value && /^\/field(?:\?|$)/.test(value) ? value : null
}
