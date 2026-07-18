import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { cn } from '@renderer/lib/utils'

export function CreateGroupDialog({ open, users, currentUserId, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const availableUsers = useMemo(
    () => users.filter((item) => item.id !== currentUserId),
    [currentUserId, users],
  )

  useEffect(() => {
    if (!open) return
    setName('')
    setSelectedIds(new Set())
    setError(null)
    setIsSaving(false)
  }, [open])

  function toggleUser(userId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Group name is required')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await onCreate(trimmed, [...selectedIds])
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
      description="Create a group chat for your organization."
      className="max-w-md"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Warehouse team"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Members</Label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
            {availableUsers.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">
                No other users available.
              </p>
            ) : (
              availableUsers.map((chatUser) => {
                const checked = selectedIds.has(chatUser.id)
                return (
                  <label
                    key={chatUser.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50',
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
                      <span className="block truncate text-sm font-medium text-gray-900">
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
          <p className="text-xs text-[var(--color-muted)]">
            You are added automatically. {selectedIds.size} other member
            {selectedIds.size === 1 ? '' : 's'} selected.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
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
