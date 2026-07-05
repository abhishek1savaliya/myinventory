import type { UserRole, UserStatus } from '../types/index.js'
import type { AppFeature } from './features.js'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
  extraFeatures: AppFeature[]
  features: AppFeature[]
}
export interface LoginResponse {
  token: string
  user: AuthUser
}

export interface JwtPayload {
  sub: string
  email: string
  name: string
  role: UserRole
  iat?: number
  exp?: number
}
