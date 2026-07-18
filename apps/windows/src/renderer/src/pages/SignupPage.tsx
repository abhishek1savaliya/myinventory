// @ts-nocheck
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@renderer/contexts/use-auth'
import { ApiRequestError, apiFetch } from '@renderer/lib/api-client'
import { orgLoginPath, orgPostAuthPath } from '@renderer/lib/org-paths'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'

export function SignupPage() {
  const { login, isAuthenticated, isLoading, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    ownerName: '',
    tradingName: '',
    email: '',
    password: '',
    contactNumber: '',
  })
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.organization?.slug) {
      navigate(orgPostAuthPath(user), { replace: true })
    }
  }, [isLoading, isAuthenticated, user, navigate])

  function updateField(field) {
    return (event) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const result = await apiFetch('/api/organizations/signup', {
        method: 'POST',
        body: JSON.stringify(form),
      })

      try {
        const loggedInUser = await login({
          orgId: result.orgCode,
          email: result.ownerEmail,
          password: form.password,
        })
        navigate(orgPostAuthPath(loggedInUser), { replace: true })
      } catch {
        navigate(orgLoginPath(result.slug), { replace: true })
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message)
      } else {
        setError('Unable to create organization. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isLoading && isAuthenticated) {
    return null
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--color-background)] p-4 sm:p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Register your organization</CardTitle>
          <CardDescription>
            Create your company workspace on MyInventory. You will be the admin owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-center text-sm">
            <Link to="/login" className="text-[var(--color-primary)] hover:underline">
              ← Back to home
            </Link>
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={updateField('name')}
                placeholder="Abhishek Water Supplies"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerName">Owner</Label>
              <Input
                id="ownerName"
                value={form.ownerName}
                onChange={updateField('ownerName')}
                placeholder="Full name of the owner"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradingName">Trading name</Label>
              <Input
                id="tradingName"
                value={form.tradingName}
                onChange={updateField('tradingName')}
                placeholder="Name shown on invoices"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Organization email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={updateField('email')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={updateField('password')}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact number</Label>
              <Input
                id="contactNumber"
                type="tel"
                value={form.contactNumber}
                onChange={updateField('contactNumber')}
                placeholder="+61 400 000 000"
                required
              />
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              After registration you will see your organization ID and sign-in details on the next
              page.
            </p>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating organization...' : 'Create organization'}
            </Button>
            <p className="text-center text-sm text-[var(--color-muted)]">
              Already have an account? Use your organization URL to sign in.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
