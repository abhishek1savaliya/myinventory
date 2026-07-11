import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Search } from 'lucide-react'
import type { OrganizationSearchResult } from '@myinventory/shared'
import { ApiRequestError, apiFetch } from '@renderer/lib/api-client'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { cn } from '@renderer/lib/utils'

export function OrganizationSearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrganizationSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setHasSearched(false)
      setError(null)
      return undefined
    }

    const timer = setTimeout(() => {
      setIsSearching(true)
      setError(null)

      void apiFetch<{ data: OrganizationSearchResult[] }>(
        `/api/organizations/search?q=${encodeURIComponent(trimmed)}`,
      )
        .then((response) => {
          setResults(response.data)
          setHasSearched(true)
        })
        .catch((err) => {
          setResults([])
          setHasSearched(true)
          if (err instanceof ApiRequestError) {
            setError(err.message)
          } else {
            setError('Could not search organizations. Please try again.')
          }
        })
        .finally(() => {
          setIsSearching(false)
        })
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setError('Enter at least 2 characters to search')
      return
    }

    if (results.length === 1) {
      openOrganizationLogin(results[0])
    }
  }

  function openOrganizationLogin(org: OrganizationSearchResult) {
    navigate(`/login/${org.slug}`, { state: { orgCode: org.orgCode } })
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-background)] p-6">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          <CardTitle>Find your organization</CardTitle>
          <CardDescription>
            Search by organization name, trading name, or organization ID
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="org-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                <Input
                  id="org-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. Acme Warehouse or AWS95625"
                  className="pl-9"
                  autoFocus
                />
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                Type at least 2 characters. Results update as you type.
              </p>
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            {results.length === 1 && (
              <Button type="submit" className="w-full">
                Continue to sign in
              </Button>
            )}
          </form>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {isSearching && (
              <p className="py-6 text-center text-sm text-[var(--color-muted)]">Searching…</p>
            )}

            {!isSearching && hasSearched && results.length === 0 && query.trim().length >= 2 && (
              <p className="py-6 text-center text-sm text-[var(--color-muted)]">
                No organizations found. Try a different name or organization ID.
              </p>
            )}

            {!isSearching &&
              results.map((org) => (
                <button
                  key={org.slug}
                  type="button"
                  onClick={() => openOrganizationLogin(org)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-3 text-left transition-colors hover:bg-gray-50',
                  )}
                >
                  {org.logoUrl ? (
                    <img
                      src={org.logoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-sidebar-active)] text-[var(--color-primary)]">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{org.tradingName}</p>
                    <p className="truncate text-xs text-[var(--color-muted)]">{org.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase text-[var(--color-muted)]">
                      {org.orgCode}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
