'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/use-auth'
import { ApiRequestError, apiFetch } from '@/lib/api-client'
import { dashboardPath } from '@/lib/org-paths'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginPage({ orgSlug }) {
  const { login, isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [orgProfile, setOrgProfile] = useState(null)
  const [orgId, setOrgId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadOrg() {
      try {
        const response = await apiFetch(`/api/organizations/by-slug/${orgSlug}`)
        if (!cancelled) {
          setOrgProfile(response.data)
        }
      } catch {
        if (!cancelled) {
          setOrgProfile(null)
        }
      }
    }

    void loadOrg()

    return () => {
      cancelled = true
    }
  }, [orgSlug])

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.organization?.slug) {
      router.replace(dashboardPath(user.organization.slug))
    }
  }, [isLoading, isAuthenticated, user, router])

  if (!isLoading && isAuthenticated) {
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const loggedInUser = await login({
        orgId: orgId.trim().toUpperCase(),
        email,
        password,
      })

      if (loggedInUser.organization.slug !== orgSlug) {
        setError(
          `This login belongs to ${loggedInUser.organization.name}. Use /${loggedInUser.organization.slug}/login instead.`,
        )
        return
      }

      router.replace(dashboardPath(orgSlug))
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message)
      } else {
        setError('Unable to sign in. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-background)] p-4 sm:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {orgProfile ? `Sign in to ${orgProfile.tradingName}` : 'Sign in to MyInventory'}
          </CardTitle>
          <CardDescription>
            {orgProfile
              ? 'Enter your organization ID, email, and password'
              : 'Organization sign in'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-center text-sm">
            <Link href="/" className="text-[var(--color-primary)] hover:underline">
              ← Back to home
            </Link>
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgId">Organization ID</Label>
              <Input
                id="orgId"
                autoComplete="organization"
                placeholder="e.g. AWS95625"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value.toUpperCase())}
                required
              />
              <p className="text-xs text-[var(--color-muted)]">
                3 letters + 5 numbers — provided when your organization registered
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
