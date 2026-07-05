'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/use-auth'

export function FeatureGate({ feature, children }) {
  const { hasFeature, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !hasFeature(feature)) {
      router.replace('/dashboard')
    }
  }, [isLoading, hasFeature, feature, router])

  if (isLoading || !hasFeature(feature)) {
    return null
  }

  return children
}
