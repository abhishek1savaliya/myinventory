import { useEffect, useMemo, useState } from 'react'
import { Dialog } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { ProfilePhotoCropDialog } from '@renderer/components/settings/ProfilePhotoCropDialog'
import { cn } from '@renderer/lib/utils'

export function ManageGroupMembersDialog({
  open,
  group,
  users,
  currentUserId,
  onClose,
  onAddMembers,
  onRemoveMember,
  onSetCanSend,
  onUpdatePhoto,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [error, setError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [photoCropUrl, setPhotoCropUrl] = useState(null)

  const memberIds = useMemo(
    () => new Set((group?.members ?? []).map((member) => member.user.id)),
    [group],
  )

  const candidates = useMemo(
    () => users.filter((item) => item.id !== currentUserId && !memberIds.has(item.id)),
    [currentUserId, memberIds, users],
  )

  useEffect(() => {
    if (!open) return
    setSelectedIds(new Set())
    setError(null)
    setBusyKey(null)
  }, [open, group?.id])

  useEffect(() => {
    return () => {
      if (photoCropUrl) URL.revokeObjectURL(photoCropUrl)
    }
  }, [photoCropUrl])

  function toggleUser(userId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return
    setBusyKey('add')
    setError(null)
    try {
      await onAddMembers([...selectedIds])
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add members')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRemove(userId) {
    setBusyKey(`remove:${userId}`)
    setError(null)
    try {
      await onRemoveMember(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleMuteToggle(userId, canSend) {
    setBusyKey(`mute:${userId}`)
    setError(null)
    try {
      await onSetCanSend(userId, canSend)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update mute')
    } finally {
      setBusyKey(null)
    }
  }

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
    setBusyKey('photo')
    setError(null)
    try {
      await onUpdatePhoto(blob)
      setPhotoCropUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update group photo')
    } finally {
      setBusyKey(null)
    }
  }

  async function handlePhotoRemove() {
    setBusyKey('photo')
    setError(null)
    try {
      await onUpdatePhoto(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove group photo')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <>
      <ProfilePhotoCropDialog
        imageUrl={photoCropUrl}
        busy={busyKey === 'photo'}
        title="Adjust group photo"
        onCancel={() => setPhotoCropUrl(null)}
        onConfirm={handlePhotoUpload}
      />
      <Dialog
        open={open}
        onClose={onClose}
        title="Manage group"
        description={group ? `${group.name} · ${group.members.length} members` : undefined}
        className="max-w-lg"
      >
        <div className="space-y-5">
          {group && (
            <div className="flex items-center gap-4 rounded-lg border border-[var(--color-border)] p-3">
              {group.photoUrl ? (
                <img src={group.photoUrl} alt={`${group.name} group`} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-800 text-xl font-semibold text-white">
                  {group.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild type="button" variant="outline" size="sm" disabled={busyKey !== null}>
                  <label className="cursor-pointer">
                    Change photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoSelected}
                      disabled={busyKey !== null}
                    />
                  </label>
                </Button>
                {group.photoUrl && (
                  <Button type="button" variant="outline" size="sm" onClick={handlePhotoRemove} disabled={busyKey !== null}>
                    Remove photo
                  </Button>
                )}
              </div>
            </div>
          )}
        <div className="space-y-2">
          <Label>Current members</Label>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
            {(group?.members ?? []).length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">
                No members yet.
              </p>
            ) : (
              group.members.map((member) => {
                const isSelf = member.user.id === currentUserId
                return (
                  <div
                    key={member.user.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-primary-foreground)]">
                      {member.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {member.user.name}
                        {isSelf ? ' (you)' : ''}
                      </p>
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {member.canSend ? 'Can send' : 'Muted'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyKey !== null}
                        onClick={() =>
                          void handleMuteToggle(member.user.id, !member.canSend)
                        }
                      >
                        {member.canSend ? 'Mute' : 'Unmute'}
                      </Button>
                      {!isSelf && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyKey !== null}
                          onClick={() => void handleRemove(member.user.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Add members</Label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
            {candidates.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-[var(--color-muted)]">
                Everyone available is already in this group.
              </p>
            ) : (
              candidates.map((chatUser) => {
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
          <Button
            type="button"
            onClick={() => void handleAdd()}
            disabled={selectedIds.size === 0 || busyKey !== null}
          >
            {busyKey === 'add' ? 'Adding…' : `Add selected (${selectedIds.size})`}
          </Button>
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
