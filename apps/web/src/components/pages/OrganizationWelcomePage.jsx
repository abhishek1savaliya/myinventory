'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Building2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/use-auth'
import { isOrganizationOwner } from '@/lib/org-owner'
import { orgDashboardPath, orgLoginPath } from '@/lib/org-paths'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyableValue } from '@/components/ui/copyable-value'

function getAppOrigin() {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export function OrganizationWelcomePage() {
  const params = useParams()
  const orgSlug = params.orgSlug
  const { user } = useAuth()
  const org = user?.organization
  const origin = getAppOrigin()
  const loginUrl = origin ? `${origin}${orgLoginPath(orgSlug)}` : orgLoginPath(orgSlug)
  const dashboardUrl = origin ? `${origin}${orgDashboardPath(orgSlug)}` : orgDashboardPath(orgSlug)

  if (!org) {
    return <p className="text-sm text-[var(--color-muted)]">Loading organization details...</p>
  }

  const isOwner = isOrganizationOwner(user)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            {isOwner ? 'Your organization is ready' : 'Organization details'}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {isOwner
              ? 'Save and copy these details. Your team will need the organization ID to sign in.'
              : 'Review your organization information below.'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            {org.tradingName}
          </CardTitle>
          <CardDescription>{org.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <CopyableValue label="Organization name" value={org.name} />
            <CopyableValue label="Trading name" value={org.tradingName} />
            <CopyableValue label="Owner" value={org.ownerName} />
            <CopyableValue label="Organization email" value={org.email} />
            <CopyableValue label="Contact number" value={org.contactNumber} />
            <CopyableValue label="URL slug" value={org.slug} mono />
          </div>

          <CopyableValue
            label="Organization ID"
            value={org.orgCode}
            description="Required for every sign-in (3 letters + 5 numbers)"
            mono
          />

          <CopyableValue
            label="Sign-in page"
            value={loginUrl}
            description="Share this link with your team"
          />

          <CopyableValue
            label="Dashboard URL"
            value={dashboardUrl}
            description="Bookmark this page for quick access"
          />
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="space-y-2 pt-6 text-sm text-amber-950">
          <p className="font-medium">How your team signs in</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open your organization sign-in page</li>
            <li>Enter organization ID: <span className="font-mono font-semibold">{org.orgCode}</span></li>
            <li>Enter their email and password</li>
          </ol>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="w-full sm:w-auto">
          <Link href={orgDashboardPath(orgSlug)}>Continue to dashboard</Link>
        </Button>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href={orgLoginPath(orgSlug)}>View sign-in page</Link>
        </Button>
      </div>
    </div>
  )
}
