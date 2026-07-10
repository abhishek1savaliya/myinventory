'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/use-auth'
import { getNavItems } from '@/lib/nav-items'
import { orgDashboardPath } from '@/lib/org-paths'
import { DashboardPage } from '@/components/pages/DashboardPage'
import { AppFeature } from '@myinventory/shared'

export function HomePage() {
  const params = useParams()
  const orgSlug = params.orgSlug
  const { hasFeature, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !orgSlug) return

    if (hasFeature(AppFeature.DASHBOARD)) return

    const first = getNavItems(orgSlug).find((item) => hasFeature(item.feature))
    const dashboardHref = orgDashboardPath(orgSlug)
    if (first && first.href !== dashboardHref) {
      router.replace(first.href)
    }
  }, [hasFeature, isLoading, router, orgSlug])

  if (isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading...</p>
  }

  if (hasFeature(AppFeature.DASHBOARD)) {
    return <DashboardPage />
  }

  return <p className="text-sm text-[var(--color-muted)]">Loading...</p>
}
