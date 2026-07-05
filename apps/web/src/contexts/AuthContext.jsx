'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, setSessionGetter, setUnauthorizedHandler } from '@/lib/api-client'
import { clearStoredSession, getStoredSessionId, setStoredSessionId } from '@/lib/auth-storage'
import { AuthContext } from './auth-context'
import { AppFeature } from '@myinventory/shared'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(async () => {
    const sessionId = getStoredSessionId()
    if (sessionId) {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // Clear local session even if API logout fails
      }
    }
    clearStoredSession()
    setUser(null)
  }, [])

  const loadSession = useCallback(async () => {
    const sessionId = getStoredSessionId()

    if (!sessionId) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const response = await apiFetch('/api/auth/me')
      setUser(response.user)
    } catch {
      clearStoredSession()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    setSessionGetter(getStoredSessionId)
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

    setStoredSessionId(response.sessionId)
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
