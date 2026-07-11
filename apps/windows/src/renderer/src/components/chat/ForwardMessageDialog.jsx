import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

export function ForwardMessageDialog({ open, users, currentPartnerId, onSelect, onClose }) {
  if (!open) return null

  const targets = users.filter((item) => item.id !== currentPartnerId)

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">Forward message</h3>
          <p className="text-sm text-[var(--color-muted)]">Choose who to send this message to</p>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {targets.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-muted)]">
              No other users available to forward to.
            </p>
          ) : (
            targets.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelect(user.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-gray-50',
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-primary-foreground)]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="truncate text-xs text-[var(--color-muted)]">{user.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
