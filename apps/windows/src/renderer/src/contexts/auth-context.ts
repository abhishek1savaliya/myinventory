import { createContext } from 'react'
import type { AuthUser, LoginInput, UserRole, AppFeature } from '@myinventory/shared'

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (input: LoginInput) => Promise<AuthUser>
  logout: () => void
  hasRole: (...roles: UserRole[]) => boolean
  hasFeature: (feature: AppFeature) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)
