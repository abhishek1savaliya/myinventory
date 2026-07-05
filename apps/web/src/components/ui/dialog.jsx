'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function Dialog({ open, onClose, title, description, children, className }) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-xl border border-[var(--color-border)] bg-white shadow-lg sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg',
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
          <div className="min-w-0 pr-2">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 shrink-0 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  )
}
