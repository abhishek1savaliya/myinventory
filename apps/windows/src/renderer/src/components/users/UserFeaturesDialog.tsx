import { useEffect, useMemo, useState } from 'react'
import type { AuthUser } from '@myinventory/shared'
import { ALL_APP_FEATURES, FEATURE_LABELS, ROLE_DEFAULT_FEATURES, AppFeature } from '@myinventory/shared'
import { apiFetch, ApiRequestError } from '@renderer/lib/api-client'
import { Button } from '@renderer/components/ui/button'
import { Dialog } from '@renderer/components/ui/dialog'

interface UserFeaturesDialogProps {
  user: AuthUser | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function UserFeaturesDialog({ user, open, onClose, onSaved }: UserFeaturesDialogProps) {
  const roleDefaults = useMemo(
    () => new Set(user ? ROLE_DEFAULT_FEATURES[user.role] : []),
    [user],
  )
  const [selected, setSelected] = useState<AppFeature[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user && open) {
      setSelected(user.features ?? [])
      setError(null)
    }
  }, [user, open])

  if (!user) return null

  function toggleFeature(feature: AppFeature) {
    if (roleDefaults.has(feature)) return
    setSelected((current) =>
      current.includes(feature) ? current.filter((f) => f !== feature) : [...current, feature],
    )
  }

  async function handleSave() {
    if (!user) return

    setError(null)
    setIsSaving(true)

    try {
      await apiFetch(`/api/users/${user.id}/features`, {
        method: 'PATCH',
        body: JSON.stringify({ features: selected }),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Failed to update features')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Features — ${user.name}`}
      description="Role defaults are always enabled. Toggle additional features for this user."
    >
      <div className="space-y-3">
        {ALL_APP_FEATURES.map((feature) => {
          const isDefault = roleDefaults.has(feature)
          const checked = selected.includes(feature)

          return (
            <label
              key={feature}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                isDefault
                  ? 'border-[var(--color-border)] bg-gray-50 text-gray-600'
                  : 'border-[var(--color-border)] bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={isDefault}
                onChange={() => toggleFeature(feature)}
                className="h-4 w-4"
              />
              <span className="flex-1">{FEATURE_LABELS[feature]}</span>
              {isDefault && (
                <span className="text-xs text-[var(--color-muted)]">Role default</span>
              )}
            </label>
          )
        })}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save features'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
