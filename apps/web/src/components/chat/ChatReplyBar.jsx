'use client'

import { X } from 'lucide-react'
import { getChatMessagePreview } from '@myinventory/shared'
import { Button } from '@/components/ui/button'

export function ChatReplyBar({ message, onCancel }) {
  if (!message) return null

  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-gray-50 px-3 py-2">
      <div className="min-w-0 flex-1 border-l-2 border-[var(--color-primary)] pl-3">
        <p className="text-xs font-semibold text-[var(--color-primary)]">
          Replying to {message.senderName ?? 'user'}
        </p>
        <p className="truncate text-sm text-[var(--color-muted)]">
          {getChatMessagePreview(message)}
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel} aria-label="Cancel reply">
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
