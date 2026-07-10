'use client'

import { useEffect, useState } from 'react'
import { UserRole } from '@myinventory/shared'
import { apiFetch, ApiRequestError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

const ROLES = [
  { value: UserRole.ADMIN, label: 'Admin' },
  { value: UserRole.MANAGER, label: 'Manager' },
  { value: UserRole.WAREHOUSE_USER, label: 'Warehouse user' },
  { value: UserRole.PICKER, label: 'Picker' },
]

export function UserRoleDialog({ user, open, onClose, onSaved }) {
  const [role, setRole] = useState(UserRole.WAREHOUSE_USER)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user && open) {
      setRole(user.role)
      setError(null)
    }
  }, [user, open])

  if (!user) return null

  async function handleSave() {
    setError(null)
    setIsSaving(true)

    try {
      await apiFetch(`/api/users/${user.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Failed to update role')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Change role — ${user.name}`}
      description="Update this user's role. Extra feature permissions are adjusted to match the new role."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="user-role-select">Role</Label>
          <select
            id="user-role-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            {ROLES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving || role === user.role}>
            {isSaving ? 'Saving...' : 'Save role'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
