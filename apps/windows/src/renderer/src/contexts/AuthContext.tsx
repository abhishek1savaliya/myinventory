import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser, LoginInput, LoginResponse, UserRole, AppFeature } from '@myinventory/shared'
import { apiFetch, setTokenGetter, setUnauthorizedHandler } from '@renderer/lib/api-client'
import { clearStoredToken, getStoredToken, setStoredToken } from '@renderer/lib/auth-storage'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Clear local session even if API logout fails
    }
    clearStoredToken()
    setUser(null)
  }, [])

  const loadSession = useCallback(async () => {
    const token = getStoredToken()

    if (!token) {
      setUser(null)
      setIsLoading(false)
      return null
    }

    try {
      const response = await apiFetch<{ user: AuthUser }>('/api/auth/me')
      setUser(response.user)
      return response.user
    } catch {
      clearStoredToken()
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      return null
    }

    try {
      const response = await apiFetch<{ user: AuthUser }>('/api/auth/me')
      setUser(response.user)
      return response.user
    } catch {
      clearStoredToken()
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    setTokenGetter(getStoredToken)
    setUnauthorizedHandler(() => {
      setUser(null)
    })
    void loadSession()
  }, [loadSession])

  const login = useCallback(async (input: LoginInput) => {
    const response = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })

    setStoredToken(response.token)
    setUser(response.user)
    return response.user
  }, [])

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false
      return roles.includes(user.role)
    },
    [user],
  )

  const hasFeature = useCallback(
    (feature: AppFeature) => {
      if (!user) return false
      return user.features?.includes(feature) ?? false
    },
    [user],
  )

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
      refreshUser,
      hasRole,
      hasFeature,
    }),
    [user, isLoading, login, logout, refreshUser, hasRole, hasFeature],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
