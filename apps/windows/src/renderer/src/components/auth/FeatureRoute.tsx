import { Navigate } from 'react-router-dom'
import type { AppFeature } from '@myinventory/shared'
import { useAuth } from '@renderer/contexts/use-auth'

interface FeatureRouteProps {
  feature: AppFeature
  children: React.ReactNode
}

export function FeatureRoute({ feature, children }: FeatureRouteProps) {
  const { hasFeature, isLoading } = useAuth()

  if (isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading...</p>
  }

  if (!hasFeature(feature)) {
    return <Navigate to="/" replace />
  }

  return children
}
