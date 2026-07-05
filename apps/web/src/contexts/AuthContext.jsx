'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, setTokenGetter, setUnauthorizedHandler } from '@/lib/api-client'
import { clearStoredToken, getStoredToken, setStoredToken } from '@/lib/auth-storage'
import { AuthContext } from './auth-context'
import { AppFeature } from '@myinventory/shared'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    clearStoredToken()
    setUser(null)
  }, [])

  const loadSession = useCallback(async () => {
    const token = getStoredToken()

    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const response = await apiFetch('/api/auth/me')
      setUser(response.user)
    } catch {
      clearStoredToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setTokenGetter(getStoredToken)
    setUnauthorizedHandler(() => {
      setUser(null)
    })
    void loadSession()
  }, [loadSession])

  const login = useCallback(async (input) => {
    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })

    setStoredToken(response.token)
    setUser(response.user)
  }, [])

  const hasRole = useCallback(
    (...roles) => {
      if (!user) return false
      return roles.includes(user.role)
    },
    [user],
  )

  const hasFeature = useCallback(
    (feature) => {
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
      hasRole,
      hasFeature,
    }),
    [user, isLoading, login, logout, hasRole, hasFeature],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
