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

const brandingImageBase64Schema = z.string().max(3_000_000, 'Image is too large')

const themeColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Theme color must be a hex value like #1e3a5f')

export const organizationBrandingUpdateSchema = z.object({
  logoBase64: brandingImageBase64Schema.optional(),
  loginBackgroundBase64: brandingImageBase64Schema.optional(),
  themeColor: themeColorSchema.nullable().optional(),
  removeLogo: z.boolean().optional(),
  removeLoginBackground: z.boolean().optional(),
})

export type OrganizationBrandingUpdateInput = z.infer<typeof organizationBrandingUpdateSchema>

export const organizationBrandingSchema = z.object({
  logoUrl: z.string().url().nullable(),
  loginBackgroundUrl: z.string().url().nullable(),
  themeColor: themeColorSchema.nullable(),
})

export const organizationPublicProfileSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tradingName: z.string(),
  logoUrl: z.string().url().nullable(),
  loginBackgroundUrl: z.string().url().nullable(),
  themeColor: themeColorSchema.nullable(),
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
  logoUrl: z.string().url().nullable(),
  loginBackgroundUrl: z.string().url().nullable(),
  themeColor: themeColorSchema.nullable(),
})

export const organizationSignupResponseSchema = z.object({
  organization: organizationSummarySchema,
  orgCode: orgCodeSchema,
  slug: z.string(),
  ownerEmail: z.string().email(),
})

export { orgCodeSchema }
