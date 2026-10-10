import { z } from 'zod'

export const contactPersonSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().max(80).default(''),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address.').max(254)]).transform(value => value.toLowerCase()).default(''),
  phone: z.string().trim().max(40).default(''),
  relationshipStatus: z.enum(['active', 'keep_in_touch', 'inactive']).nullable().default(null),
})
