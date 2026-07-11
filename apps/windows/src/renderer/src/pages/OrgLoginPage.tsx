import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { OrganizationPublicProfile } from '@myinventory/shared'
import { useAuth } from '@renderer/contexts/use-auth'
import { ApiRequestError, apiFetch } from '@renderer/lib/api-client'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'

type LoginLocationState = {
  orgCode?: string
}

export function OrgLoginPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading } = useAuth()
  const orgCodeFromState = (location.state as LoginLocationState | null)?.orgCode ?? ''

  const [orgProfile, setOrgProfile] = useState<OrganizationPublicProfile | null>(null)
  const [orgId, setOrgId] = useState(orgCodeFromState)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!orgSlug) return

    void apiFetch<{ data: OrganizationPublicProfile }>(`/api/organizations/by-slug/${orgSlug}`)
      .then((response) => setOrgProfile(response.data))
      .catch(() => setOrgProfile(null))
  }, [orgSlug])

  useEffect(() => {
    if (orgCodeFromState) {
      setOrgId(orgCodeFromState)
    }
  }, [orgCodeFromState])

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (!orgSlug) {
    return <Navigate to="/login" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login({
        orgId: orgId.toUpperCase().trim(),
        email,
        password,
      })
      navigate('/', { replace: true })
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

  const pageStyle = orgProfile?.loginBackgroundUrl
    ? {
        backgroundImage: `linear-gradient(rgba(248, 249, 251, 0.88), rgba(248, 249, 251, 0.92)), url(${orgProfile.loginBackgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: 'var(--color-background)' }

  const themeStyle = orgProfile?.themeColor
    ? ({ '--color-primary': orgProfile.themeColor } as CSSProperties)
    : undefined

  return (
    <div
      className="flex h-full items-center justify-center p-6"
      style={{ ...pageStyle, ...themeStyle }}
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
            {orgProfile ? orgProfile.name : 'Enter your organization ID, email, and password'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-center text-sm">
            <Link to="/login" className="text-[var(--color-primary)] hover:underline">
              ← Back to organization search
            </Link>
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgId">Organization ID</Label>
              <Input
                id="orgId"
                value={orgId}
                onChange={(event) => setOrgId(event.target.value.toUpperCase())}
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
                onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
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
