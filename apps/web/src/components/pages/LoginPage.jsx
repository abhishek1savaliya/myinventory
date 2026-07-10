'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/use-auth'
import { ApiRequestError, apiFetch } from '@/lib/api-client'
import { orgPostAuthPath } from '@/lib/org-paths'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginPage() {
  const params = useParams()
  const orgSlug = params.orgSlug
  const { login, isAuthenticated, isLoading, user } = useAuth()
  const router = useRouter()
  const [orgProfile, setOrgProfile] = useState(null)
  const [orgId, setOrgId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!orgSlug) return

    apiFetch(`/api/organizations/by-slug/${orgSlug}`)
      .then((response) => setOrgProfile(response.data))
      .catch(() => setOrgProfile(null))
  }, [orgSlug])

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.organization?.slug) {
      router.replace(orgPostAuthPath(user))
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
        orgId: orgId.toUpperCase().trim(),
        email,
        password,
      })
      router.replace(orgPostAuthPath(loggedInUser))
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
    <div
      className="flex h-full min-h-[100dvh] items-center justify-center p-4 sm:p-6"
      style={{
        ...(orgProfile?.loginBackgroundUrl
          ? {
              backgroundImage: `linear-gradient(rgba(248, 249, 251, 0.88), rgba(248, 249, 251, 0.92)), url(${orgProfile.loginBackgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : { backgroundColor: 'var(--color-background)' }),
        ...(orgProfile?.themeColor ? { '--color-primary': orgProfile.themeColor } : {}),
      }}
    >
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          {orgProfile?.logoUrl && (
            <img
              src={orgProfile.logoUrl}
              alt=""
              className="mx-auto mb-4 h-16 w-auto max-w-[220px] object-contain"
            />
          )}
          <CardTitle>
            {orgProfile ? `Sign in to ${orgProfile.tradingName}` : 'Sign in to MyInventory'}
          </CardTitle>
          <CardDescription>
            {orgProfile
              ? orgProfile.name
              : 'Enter your organization ID, email, and password'}
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
                value={orgId}
                onChange={(e) => setOrgId(e.target.value.toUpperCase())}
                placeholder="AWS95625"
                autoComplete="organization"
                className="font-mono uppercase"
                maxLength={8}
                required
              />
              <p className="text-xs text-[var(--color-muted)]">
                3 letters + 5 numbers (e.g. AWS95625)
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
          <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
            New organization?{' '}
            <Link href="/signup" className="text-[var(--color-primary)] hover:underline">
              Register here
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
