import { z } from 'zod'

const orgCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}\d{5}$/, 'Organization ID must be 3 letters followed by 5 numbers (e.g. AWS95625)')

export const organizationSignupSchema = z.object({
  name: z.string().trim().min(2, 'Organization name is required').max(255),
  ownerName: z.string().trim().min(2, 'Owner name is required').max(255),
  tradingName: z.string().trim().min(2, 'Trading name is required').max(255),
  email: z.string().email('Invalid organization email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  contactNumber: z.string().trim().min(6, 'Contact number is required').max(30),
})

export type OrganizationSignupInput = z.infer<typeof organizationSignupSchema>

export const organizationPublicProfileSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tradingName: z.string(),
})

export const organizationSummarySchema = z.object({
  id: z.string(),
  orgCode: orgCodeSchema,
  slug: z.string(),
  name: z.string(),
  tradingName: z.string(),
  ownerName: z.string(),
  email: z.string().email(),
  contactNumber: z.string(),
})

export const organizationSignupResponseSchema = z.object({
  organization: organizationSummarySchema,
  orgCode: orgCodeSchema,
  slug: z.string(),
  ownerEmail: z.string().email(),
})

export { orgCodeSchema }
