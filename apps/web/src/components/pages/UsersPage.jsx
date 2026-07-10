'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserRole, UserStatus } from '@myinventory/shared'
import { apiFetch, ApiRequestError } from '@/lib/api-client'
import { useAuth } from '@/contexts/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { PageLoader } from '@/components/ui/loader'
import { UserFeaturesDialog } from '@/components/users/UserFeaturesDialog'
import { UserRoleDialog } from '@/components/users/UserRoleDialog'
import { formatDate } from '@/lib/utils'

const ROLES = [
  { value: UserRole.ADMIN, label: 'Admin' },
  { value: UserRole.MANAGER, label: 'Manager' },
  { value: UserRole.WAREHOUSE_USER, label: 'Warehouse user' },
  { value: UserRole.PICKER, label: 'Picker' },
]

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: UserRole.WAREHOUSE_USER,
}

function UserTable({ users, currentUserId, onDisable, onActivate, onManageFeatures, onChangeRole }) {
  if (users.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No users in this list.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-[var(--color-border)] bg-gray-50">
          <tr>
            <th className="px-4 py-3 font-medium text-gray-700">Name</th>
            <th className="px-4 py-3 font-medium text-gray-700">Email</th>
            <th className="px-4 py-3 font-medium text-gray-700">Role</th>
            <th className="px-4 py-3 font-medium text-gray-700">Status</th>
            <th className="px-4 py-3 font-medium text-gray-700">Created</th>
            <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-[var(--color-border)] last:border-0">
              <td className="px-4 py-3">{user.name}</td>
              <td className="px-4 py-3">{user.email}</td>
              <td className="px-4 py-3">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {user.role}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={user.status} />
              </td>
              <td className="px-4 py-3 text-xs text-gray-600">
                {formatDate(user.createdAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {onChangeRole && user.id !== currentUserId && (
                    <Button variant="outline" size="sm" onClick={() => onChangeRole(user)}>
                      Role
                    </Button>
                  )}
                  {onManageFeatures && (
                    <Button variant="outline" size="sm" onClick={() => onManageFeatures(user)}>
                      Features
                    </Button>
                  )}
                  {onDisable && user.status === UserStatus.ACTIVE && user.id !== currentUserId && (
                    <Button variant="outline" size="sm" onClick={() => void onDisable(user)}>
                      {user.role === UserRole.ADMIN ? 'Request disable' : 'Disable'}
                    </Button>
                  )}
                  {onActivate && user.status === UserStatus.INACTIVE && (
                    <Button variant="outline" size="sm" onClick={() => void onActivate(user)}>
                      Activate
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [featuresUser, setFeaturesUser] = useState(null)
  const [featuresOpen, setFeaturesOpen] = useState(false)
  const [roleUser, setRoleUser] = useState(null)
  const [roleOpen, setRoleOpen] = useState(false)

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === UserStatus.ACTIVE),
    [users],
  )
  const disabledUsers = useMemo(
    () => users.filter((user) => user.status === UserStatus.INACTIVE),
    [users],
  )

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiFetch('/api/users')
      setUsers(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  function openCreate() {
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleCreate() {
    setFormError(null)
    setIsSaving(true)

    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(form),
      })

      setDialogOpen(false)
      await loadUsers()
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Failed to create user')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDisable(target) {
    const label =
      target.role === UserRole.ADMIN
        ? `Send disable request to ${target.name}? They must accept before the account is disabled.`
        : `Disable ${target.name}? They will be signed out on their next request.`

    if (!confirm(label)) return

    try {
      const response = await apiFetch(`/api/users/${target.id}/disable`, { method: 'PATCH' })
      alert(response.data.message)
      await loadUsers()
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : 'Failed to disable user')
    }
  }

  async function handleActivate(target) {
    if (!confirm(`Activate ${target.name}? They will be able to sign in again.`)) return

    try {
      await apiFetch(`/api/users/${target.id}/activate`, { method: 'PATCH' })
      await loadUsers()
    } catch (err) {
      alert(err instanceof ApiRequestError ? err.message : 'Failed to activate user')
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Users</h2>
          <p className="text-sm text-[var(--color-muted)]">
            Create and manage accounts. Disabling an admin requires their acceptance. At least one
            active admin must remain.
          </p>
        </div>
        <Button onClick={openCreate}>Add user</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-lg font-medium text-gray-900">Active users</h3>
            <UserTable
              users={activeUsers}
              currentUserId={currentUser?.id}
              onDisable={handleDisable}
              onChangeRole={(user) => {
                setRoleUser(user)
                setRoleOpen(true)
              }}
              onManageFeatures={(user) => {
                setFeaturesUser(user)
                setFeaturesOpen(true)
              }}
            />
          </section>

          <section>
            <h3 className="mb-3 text-lg font-medium text-gray-900">Disabled users</h3>
            <UserTable
              users={disabledUsers}
              onActivate={handleActivate}
              onChangeRole={(user) => {
                setRoleUser(user)
                setRoleOpen(true)
              }}
              onManageFeatures={(user) => {
                setFeaturesUser(user)
                setFeaturesOpen(true)
              }}
            />
          </section>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add user"
        description="Create a new account with a role. Password must be at least 8 characters."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Full name</Label>
            <Input
              id="user-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">Password</Label>
            <Input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">Role</Label>
            <select
              id="user-role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
            >
              {ROLES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={isSaving}>
              {isSaving ? 'Creating...' : 'Create user'}
            </Button>
          </div>
        </div>
      </Dialog>

      <UserRoleDialog
        user={roleUser}
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        onSaved={() => void loadUsers()}
      />

      <UserFeaturesDialog
        user={featuresUser}
        open={featuresOpen}
        onClose={() => setFeaturesOpen(false)}
        onSaved={() => void loadUsers()}
      />
    </div>
  )
}
