'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/use-auth'
import { orgDashboardPath } from '@/lib/org-paths'

export function RoleGate({ roles, children }) {
  const { hasRole, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !hasRole(...roles) && user?.organization?.slug) {
      router.replace(orgDashboardPath(user.organization.slug))
    }
  }, [isLoading, hasRole, roles, router, user])

  if (isLoading || !hasRole(...roles)) {
    return null
  }

  return children
}
