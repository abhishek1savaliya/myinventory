'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/use-auth'

export function RoleGate({ roles, children }) {
  const { hasRole, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !hasRole(...roles)) {
      router.replace('/')
    }
  }, [isLoading, hasRole, roles, router])

  if (isLoading || !hasRole(...roles)) {
    return null
  }

  return children
}
