import type { UserRole, UserStatus } from '../types/index.js'
import type { AppFeature } from './features.js'
import type { OrganizationSummary } from './organization.js'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
  extraFeatures: AppFeature[]
  features: AppFeature[]
  organization: OrganizationSummary
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
  orgId: string
  orgSlug: string
  orgCode: string
  iat?: number
  exp?: number
}
