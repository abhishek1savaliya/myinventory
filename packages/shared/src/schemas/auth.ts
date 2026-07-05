import { z } from 'zod'
import { UserRole } from '../types/index.js'
import { AppFeature } from '../types/features.js'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  createdAt: z.string(),
  extraFeatures: z.array(z.nativeEnum(AppFeature)),
  features: z.array(z.nativeEnum(AppFeature)),
})

export const loginResponseSchema = z.object({
  token: z.string(),
  user: authUserSchema,
})

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
