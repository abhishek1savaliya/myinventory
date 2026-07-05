import { z } from 'zod'
import { AppFeature } from '../types/features.js'

export const disableUserResponseSchema = z.object({
  disabled: z.boolean(),
  pendingApproval: z.boolean().optional(),
  requestId: z.string().optional(),
  message: z.string(),
})

export type DisableUserResponse = z.infer<typeof disableUserResponseSchema>

export const updateUserFeaturesSchema = z.object({
  features: z.array(z.nativeEnum(AppFeature)).min(1, 'Select at least one feature'),
})

export type UpdateUserFeaturesInput = z.infer<typeof updateUserFeaturesSchema>