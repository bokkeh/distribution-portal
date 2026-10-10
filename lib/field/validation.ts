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
  if ((input.kind === 'order' && !input.items.length) || new Set(input.items.map(item => item.productId)).size !== input.items.length) ctx.addIssue({ code: 'custom', message: 'Choose products and whole case quantities without duplicate products.' })
  if (input.kind === 'invoice' && !input.items.length && (!input.description || !input.amount || Number(input.amount) <= 0)) ctx.addIssue({ code: 'custom', message: 'Choose saved products and quantities, or enter a description and positive amount for a custom invoice.' })
  if (input.kind === 'invoice' && input.items.length && (input.description || input.amount)) ctx.addIssue({ code: 'custom', message: 'Choose saved products or a custom invoice, not both.' })
})
export type FieldDocumentInput = z.input<typeof fieldDocumentSchema>

export const fieldAccountSchema = z.object({
  requestId: z.uuid(),
  companyName: z.string().trim().min(1, 'Enter the account name.').max(200),
  address: z.string().trim().max(300).default(''),
  city: z.string().trim().max(100).default(''),
  state: z.string().trim().regex(/^([A-Za-z]{2})?$/, 'Use a two-letter state abbreviation.').transform(value => value.toUpperCase()).default(''),
  zip: z.string().trim().regex(/^(\d{5}(-\d{4})?)?$/, 'Enter a valid ZIP code.').default(''),
  email: z.union([z.email().max(254), z.literal('')]).default(''),
  phone: z.string().trim().max(40).default(''),
})
export type FieldAccountInput = z.input<typeof fieldAccountSchema>

export const fieldContactSchema = z.object({
  requestId: z.uuid(), accountId: z.uuid(),
  name: z.string().trim().min(1, 'Enter the contact name.').max(160),
  email: z.union([z.email().max(254), z.literal('')]).default(''),
  phone: z.string().trim().max(40).default(''),
  title: z.string().trim().max(160).default(''),
  preferredContact: z.enum(['', 'email', 'sms', 'call']).default(''),
  isPrimary: z.boolean().default(false),
})
export type FieldContactInput = z.input<typeof fieldContactSchema>

export function fieldLoginReturn(value: string | null | undefined) {
  return value && /^\/field(?:\?|$)/.test(value) ? value : null
}
