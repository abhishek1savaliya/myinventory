'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function CreateGroupDialog({ open, users, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setSelectedIds([])
    setError(null)
    setIsSaving(false)
  }, [open])

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )

  function toggleUser(userId) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Group name is required')
      return
    }

    setError(null)
    setIsSaving(true)
    try {
      await onCreate(trimmed, selectedIds)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New group"
      description="Create a group chat and optionally add members now."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Warehouse floor"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Members</Label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
            {sortedUsers.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">
                No other users available.
              </p>
            ) : (
              sortedUsers.map((chatUser) => {
                const checked = selectedIds.includes(chatUser.id)
                return (
                  <label
                    key={chatUser.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-gray-50',
                      checked && 'bg-[var(--color-sidebar-active)]',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUser(chatUser.id)}
                      className="h-4 w-4"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-900">
                        {chatUser.name}
                      </span>
                      <span className="block truncate text-xs text-[var(--color-muted)]">
                        {chatUser.email}
                      </span>
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={isSaving}>
            {isSaving ? 'Creating…' : 'Create group'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
