import { z } from 'zod'

// Empty strings represent contact details the admin has not collected yet.
export const optionalCommunityEmail = z.string().trim().max(254)
  .refine(value => !value || z.string().email().safeParse(value).success, 'Enter a valid email address.')
  .transform(value => value.toLowerCase()).default('')
export const optionalCommunityPhone = z.string().trim().max(40)
  .refine(value => !value || value.length >= 7, 'Enter a valid phone number.').default('')

export const adminCommunityPersonSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  email: optionalCommunityEmail,
  phone: optionalCommunityPhone,
})
