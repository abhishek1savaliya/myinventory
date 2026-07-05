import { Navigate } from 'react-router-dom'
import { AppFeature } from '@myinventory/shared'
import { useAuth } from '@renderer/contexts/use-auth'
import { navItems } from '@renderer/components/layout/AppShell'
import { DashboardPage } from '@renderer/pages/DashboardPage'

export function HomePage() {
  const { hasFeature, isLoading } = useAuth()

  if (isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading...</p>
  }

  if (hasFeature(AppFeature.DASHBOARD)) {
    return <DashboardPage />
  }

  const first = navItems.find((item) => hasFeature(item.feature) && item.to !== '/')

  if (first) {
    return <Navigate to={first.to} replace />
  }

  return <p className="text-sm text-[var(--color-muted)]">No features assigned to your account.</p>
}
