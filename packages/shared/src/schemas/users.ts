import { z } from 'zod'
import { AppFeature } from '../types/features.js'
import { UserRole } from '../types/index.js'

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

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
})

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>

export const resetUserPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer')
    .optional(),
})

export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>

export const resetUserPasswordResponseSchema = z.object({
  temporaryPassword: z.string(),
})

export type ResetUserPasswordResponse = z.infer<typeof resetUserPasswordResponseSchema>