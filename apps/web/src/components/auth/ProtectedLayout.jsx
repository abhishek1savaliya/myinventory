'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/use-auth'
import { orgLoginPath } from '@/lib/org-paths'
import { AppShell } from '@/components/layout/AppShell'
import { FullPageLoader } from '@/components/ui/loader'

export function ProtectedLayout({ children }) {
  const params = useParams()
  const orgSlug = params.orgSlug
  const { isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(orgLoginPath(orgSlug))
      return
    }

    if (!isLoading && isAuthenticated && user?.organization?.slug !== orgSlug) {
      router.replace(orgLoginPath(user?.organization?.slug ?? orgSlug))
    }
  }, [isLoading, isAuthenticated, user, orgSlug, router])

  if (isLoading) {
    return <FullPageLoader />
  }

  if (!isAuthenticated || user?.organization?.slug !== orgSlug) {
    return null
  }

  return <AppShell orgSlug={orgSlug}>{children}</AppShell>
}
