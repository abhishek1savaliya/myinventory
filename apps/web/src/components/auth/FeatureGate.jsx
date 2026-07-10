'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/use-auth'
import { orgDashboardPath } from '@/lib/org-paths'

export function FeatureGate({ feature, children }) {
  const { hasFeature, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !hasFeature(feature) && user?.organization?.slug) {
      router.replace(orgDashboardPath(user.organization.slug))
    }
  }, [isLoading, hasFeature, feature, router, user])

  if (isLoading || !hasFeature(feature)) {
    return null
  }

  return children
}
