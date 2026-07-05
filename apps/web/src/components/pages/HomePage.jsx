'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/use-auth'
import { navItems } from '@/lib/nav-items'
import { DashboardPage } from '@/components/pages/DashboardPage'
import { AppFeature } from '@myinventory/shared'

export function HomePage() {
  const { hasFeature, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (hasFeature(AppFeature.DASHBOARD)) return

    const first = navItems.find((item) => hasFeature(item.feature))
    if (first && first.href !== '/') {
      router.replace(first.href)
    }
  }, [hasFeature, isLoading, router])

  if (isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading...</p>
  }

  if (hasFeature(AppFeature.DASHBOARD)) {
    return <DashboardPage />
  }

  return <p className="text-sm text-[var(--color-muted)]">Loading...</p>
}
