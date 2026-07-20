'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiRequestError, apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SYSTEM_ADMIN_ID_KEY = 'myinventory_system_admin_id'
const SYSTEM_ADMIN_PASSWORD_KEY = 'myinventory_system_admin_password'

function getStoredCredentials() {
  if (typeof window === 'undefined') {
    return { adminId: '', password: '' }
  }

  return {
    adminId: window.localStorage.getItem(SYSTEM_ADMIN_ID_KEY) ?? '',
    password: window.localStorage.getItem(SYSTEM_ADMIN_PASSWORD_KEY) ?? '',
  }
}

function storeCredentials(adminId, password) {
  window.localStorage.setItem(SYSTEM_ADMIN_ID_KEY, adminId)
  window.localStorage.setItem(SYSTEM_ADMIN_PASSWORD_KEY, password)
}

function clearCredentials() {
  window.localStorage.removeItem(SYSTEM_ADMIN_ID_KEY)
  window.localStorage.removeItem(SYSTEM_ADMIN_PASSWORD_KEY)
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function buildAdminHeaders(credentials) {
  return {
    'X-System-Admin-Id': credentials.adminId,
    'X-System-Admin-Password': credentials.password,
  }
}

function DetailItem({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={mono ? 'font-mono text-sm text-gray-900' : 'text-sm font-medium text-gray-900'}>
        {value || '—'}
      </p>
    </div>
  )
}

export function SystemAdminPage() {
  const [credentials, setCredentials] = useState({ adminId: '', password: '' })
  const [draftCredentials, setDraftCredentials] = useState({ adminId: '', password: '' })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [organizations, setOrganizations] = useState([])
  const [selectedOrganization, setSelectedOrganization] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [disableLoadingId, setDisableLoadingId] = useState('')
  const [enableLoadingId, setEnableLoadingId] = useState('')
  const [search, setSearch] = useState('')

  const loadOrganizations = useCallback(async (activeCredentials) => {
    const response = await apiFetch('/api/system-admin/organizations', {
      headers: buildAdminHeaders(activeCredentials),
    })
    setOrganizations(response.data ?? [])
  }, [])

  useEffect(() => {
    const stored = getStoredCredentials()
    setDraftCredentials(stored)

    if (!stored.adminId || !stored.password) {
      setIsLoading(false)
      return
    }

    setCredentials(stored)
    loadOrganizations(stored)
      .then(() => {
        setIsAuthenticated(true)
        setError('')
      })
      .catch((err) => {
        clearCredentials()
        setCredentials({ adminId: '', password: '' })
        setDraftCredentials({ adminId: '', password: '' })
        setIsAuthenticated(false)
        setError(err instanceof Error ? err.message : 'Unable to load system admin portal')
      })
      .finally(() => setIsLoading(false))
  }, [loadOrganizations])

  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return organizations

    return organizations.filter((organization) =>
      [
        organization.name,
        organization.tradingName,
        organization.slug,
        organization.orgCode,
        organization.ownerName,
        organization.email,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    )
  }, [organizations, search])

  async function handleLogin(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    setMessage('')

    const nextCredentials = {
      adminId: draftCredentials.adminId.trim(),
      password: draftCredentials.password,
    }

    try {
      await loadOrganizations(nextCredentials)
      storeCredentials(nextCredentials.adminId, nextCredentials.password)
      setCredentials(nextCredentials)
      setIsAuthenticated(true)
    } catch (err) {
      setIsAuthenticated(false)
      if (err instanceof ApiRequestError) {
        setError(err.message)
      } else {
        setError('Unable to sign in to the system admin portal')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleOpenDetails(organizationId) {
    setDetailsOpen(true)
    setDetailsLoading(true)
    setError('')

    try {
      const response = await apiFetch(`/api/system-admin/organizations/${organizationId}`, {
        headers: buildAdminHeaders(credentials),
      })
      setSelectedOrganization(response.data)
    } catch (err) {
      setSelectedOrganization(null)
      setError(err instanceof Error ? err.message : 'Unable to load organization details')
    } finally {
      setDetailsLoading(false)
    }
  }

  async function handleDisableOrganization(organizationId) {
    setDisableLoadingId(organizationId)
    setError('')
    setMessage('')

    try {
      const response = await apiFetch(`/api/system-admin/organizations/${organizationId}/disable`, {
        method: 'POST',
        headers: buildAdminHeaders(credentials),
      })

      setMessage(response.message ?? 'Organization disabled')
      setOrganizations((current) =>
        current.map((organization) =>
          organization.id === organizationId ? response.organization : organization,
        ),
      )

      if (selectedOrganization?.id === organizationId) {
        setSelectedOrganization((current) =>
          current
            ? {
                ...current,
                isDisabled: true,
                users: current.users.map((user) => ({ ...user, status: 'INACTIVE' })),
                activeUsers: 0,
                inactiveUsers: current.users.length,
              }
            : current,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to disable organization')
    } finally {
      setDisableLoadingId('')
    }
  }

  async function handleEnableOrganization(organizationId) {
    setEnableLoadingId(organizationId)
    setError('')
    setMessage('')

    try {
      const response = await apiFetch(`/api/system-admin/organizations/${organizationId}/enable`, {
        method: 'POST',
        headers: buildAdminHeaders(credentials),
      })

      setMessage(response.message ?? 'Organization enabled')
      setOrganizations((current) =>
        current.map((organization) =>
          organization.id === organizationId ? response.organization : organization,
        ),
      )

      if (selectedOrganization?.id === organizationId) {
        setSelectedOrganization((current) => {
          if (!current) return current
          const users = current.users.map((user) => ({ ...user, status: 'ACTIVE' }))
          const activeUsers = users.filter((user) => user.status === 'ACTIVE').length
          const inactiveUsers = users.length - activeUsers
          return {
            ...current,
            isDisabled: activeUsers === 0,
            users,
            activeUsers,
            inactiveUsers,
          }
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to enable organization')
    } finally {
      setEnableLoadingId('')
    }
  }

  function handleLogout() {
    clearCredentials()
    setCredentials({ adminId: '', password: '' })
    setDraftCredentials({ adminId: '', password: '' })
    setOrganizations([])
    setSelectedOrganization(null)
    setIsAuthenticated(false)
    setError('')
    setMessage('')
  }

  if (isLoading) {
    return (
      <main className="min-h-dvh bg-gray-50 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm text-muted">Loading system admin portal...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-10 sm:px-6">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle>System Admin Portal</CardTitle>
            <CardDescription>Use the system admin credentials to manage organizations.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="system-admin-id">ID</Label>
                <Input
                  id="system-admin-id"
                  value={draftCredentials.adminId}
                  onChange={(event) =>
                    setDraftCredentials((current) => ({ ...current, adminId: event.target.value }))
                  }
                  placeholder="admin or 123456"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="system-admin-password">Password</Label>
                <Input
                  id="system-admin-password"
                  type="password"
                  value={draftCredentials.password}
                  onChange={(event) =>
                    setDraftCredentials((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="admin"
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
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-gray-50 px-4 py-8 sm:px-6">
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={selectedOrganization?.tradingName ?? 'Organization details'}
        description={selectedOrganization?.name ?? 'Detailed organization information'}
        className="sm:max-w-3xl"
      >
        {detailsLoading ? (
          <p className="text-sm text-muted">Loading details...</p>
        ) : selectedOrganization ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Organization ID" value={selectedOrganization.orgCode} mono />
              <DetailItem label="Slug" value={selectedOrganization.slug} mono />
              <DetailItem label="Owner" value={selectedOrganization.ownerName} />
              <DetailItem label="Created" value={formatDate(selectedOrganization.createdAt)} />
              <DetailItem label="Email" value={selectedOrganization.email} />
              <DetailItem label="Contact" value={selectedOrganization.contactNumber} />
              <DetailItem
                label="Status"
                value={selectedOrganization.isDisabled ? 'Disabled' : 'Active'}
              />
              <DetailItem label="Theme color" value={selectedOrganization.themeColor} mono />
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Users</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{selectedOrganization.totalUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Active</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{selectedOrganization.activeUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Inactive</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{selectedOrganization.inactiveUsers}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Products</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{selectedOrganization.totalProducts}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Warehouses</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{selectedOrganization.totalWarehouses}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted">Locations</p>
                  <p className="mt-1 text-xl font-semibold text-gray-900">{selectedOrganization.totalLocations}</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Users</h3>
                  <p className="text-xs text-muted">
                    Latest accounts in this organization.
                  </p>
                </div>
                {selectedOrganization.isDisabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleEnableOrganization(selectedOrganization.id)}
                    disabled={enableLoadingId === selectedOrganization.id}
                  >
                    {enableLoadingId === selectedOrganization.id ? 'Enabling...' : 'Enable organization'}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleDisableOrganization(selectedOrganization.id)}
                    disabled={disableLoadingId === selectedOrganization.id}
                  >
                    {disableLoadingId === selectedOrganization.id ? 'Disabling...' : 'Disable organization'}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrganization.users.map((user) => (
                      <tr key={user.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                        <td className="px-4 py-3 text-gray-700">{user.email}</td>
                        <td className="px-4 py-3 text-gray-700">{user.role}</td>
                        <td className="px-4 py-3 text-gray-700">{user.status}</td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No organization selected.</p>
        )}
      </Dialog>

      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">System Admin Portal</h1>
            <p className="text-sm text-muted">
              View every organization, inspect account details, and disable organizations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, ID, slug, owner, or email"
              className="w-full sm:w-80"
            />
            <Button type="button" variant="outline" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted">Organizations</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{organizations.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted">Active organizations</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {organizations.filter((organization) => !organization.isDisabled).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted">Disabled organizations</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {organizations.filter((organization) => organization.isDisabled).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted">Visible after filter</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{filteredOrganizations.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>All registered organizations in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Users</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrganizations.map((organization) => (
                    <tr key={organization.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{organization.tradingName}</div>
                        <div className="text-xs text-muted">
                          {organization.name} · {organization.slug}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">{organization.orgCode}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{organization.ownerName}</div>
                        <div className="text-xs text-muted">{organization.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {organization.activeUsers} active / {organization.totalUsers} total
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            organization.isDisabled
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {organization.isDisabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(organization.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleOpenDetails(organization.id)}
                          >
                            Details
                          </Button>
                          {organization.isDisabled ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={enableLoadingId === organization.id}
                              onClick={() => void handleEnableOrganization(organization.id)}
                            >
                              {enableLoadingId === organization.id ? 'Enabling...' : 'Enable'}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={disableLoadingId === organization.id}
                              onClick={() => void handleDisableOrganization(organization.id)}
                            >
                              {disableLoadingId === organization.id ? 'Disabling...' : 'Disable'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredOrganizations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                        No organizations match the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
