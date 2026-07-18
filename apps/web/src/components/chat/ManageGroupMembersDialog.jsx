'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ProfilePhotoCropDialog } from '@/components/settings/ProfilePhotoCropDialog'
import { cn } from '@/lib/utils'

export function ManageGroupMembersDialog({
  open,
  group,
  availableUsers,
  onClose,
  onAddMembers,
  onRemoveMember,
  onToggleMute,
  onUpdatePhoto,
}) {
  const [selectedIds, setSelectedIds] = useState([])
  const [error, setError] = useState(null)
  const [busyUserId, setBusyUserId] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [photoCropUrl, setPhotoCropUrl] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelectedIds([])
    setError(null)
    setBusyUserId(null)
    setIsAdding(false)
  }, [open, group?.id])

  useEffect(() => {
    return () => {
      if (photoCropUrl) URL.revokeObjectURL(photoCropUrl)
    }
  }, [photoCropUrl])

  const memberIds = useMemo(
    () => new Set((group?.members ?? []).map((member) => member.user.id)),
    [group],
  )

  const addableUsers = useMemo(
    () =>
      availableUsers
        .filter((user) => !memberIds.has(user.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [availableUsers, memberIds],
  )

  const members = useMemo(
    () =>
      [...(group?.members ?? [])].sort((a, b) => a.user.name.localeCompare(b.user.name)),
    [group],
  )

  function toggleUser(userId) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  async function handleAdd() {
    if (selectedIds.length === 0) return
    setError(null)
    setIsAdding(true)
    try {
      await onAddMembers(selectedIds)
      setSelectedIds([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add members')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleRemove(userId) {
    setError(null)
    setBusyUserId(userId)
    try {
      await onRemoveMember(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member')
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleMuteToggle(userId, canSend) {
    setError(null)
    setBusyUserId(userId)
    try {
      await onToggleMute(userId, canSend)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update mute')
    } finally {
      setBusyUserId(null)
    }
  }

  if (!group) return null

  function handlePhotoSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Selected image must be 15 MB or smaller.')
      return
    }
    setError(null)
    setPhotoCropUrl(URL.createObjectURL(file))
  }

  async function handlePhotoUpload(blob) {
    setPhotoBusy(true)
    setError(null)
    try {
      await onUpdatePhoto(blob)
      setPhotoCropUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update group photo')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handlePhotoRemove() {
    setPhotoBusy(true)
    setError(null)
    try {
      await onUpdatePhoto(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove group photo')
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <>
      <ProfilePhotoCropDialog
        imageUrl={photoCropUrl}
        busy={photoBusy}
        title="Adjust group photo"
        onCancel={() => setPhotoCropUrl(null)}
        onConfirm={handlePhotoUpload}
      />
      <Dialog
        open={open}
        onClose={onClose}
        title={`Manage — ${group.name}`}
        description="Change the group photo, manage members, and control who can send."
        className="sm:max-w-xl"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-lg border border-[var(--color-border)] p-3">
            {group.photoUrl ? (
              <img src={group.photoUrl} alt={`${group.name} group`} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-800 text-xl font-semibold text-white">
                {group.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" variant="outline" size="sm" disabled={photoBusy}>
                <label className="cursor-pointer">
                  Change photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoSelected}
                    disabled={photoBusy}
                  />
                </label>
              </Button>
              {group.photoUrl && (
                <Button type="button" variant="outline" size="sm" onClick={handlePhotoRemove} disabled={photoBusy}>
                  Remove photo
                </Button>
              )}
            </div>
          </div>
        <div className="space-y-2">
          <Label>Current members ({members.length})</Label>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
            {members.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">
                No members yet.
              </p>
            ) : (
              members.map((member) => {
                const busy = busyUserId === member.user.id
                return (
                  <div
                    key={member.user.id}
                    className="flex items-center gap-2 rounded-md px-2 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {member.user.name}
                      </p>
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {member.user.email}
                        {!member.canSend ? ' · Muted' : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void handleMuteToggle(member.user.id, !member.canSend)
                      }
                    >
                      {member.canSend ? 'Mute' : 'Unmute'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleRemove(member.user.id)}
                    >
                      Remove
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Add members</Label>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
            {addableUsers.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">
                Everyone available is already in this group.
              </p>
            ) : (
              addableUsers.map((chatUser) => {
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
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isAdding || selectedIds.length === 0}
            >
              {isAdding ? 'Adding…' : 'Add selected'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
        </div>
      </Dialog>
    </>
  )
}
