'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export function ChatMessageActionsMenu({
  open,
  x,
  y,
  isMine,
  canReply = true,
  canForward = true,
  canDeleteForMe = true,
  canDeleteForEveryone,
  onReply,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}) {
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (menuRef.current?.contains(event.target)) return
      onClose()
    }

    function handleEscape(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  const items = []

  if (canReply) {
    items.push({ id: 'reply', label: 'Reply', onClick: onReply })
  }
  if (canForward) {
    items.push({ id: 'forward', label: 'Forward', onClick: onForward })
  }

  if (canDeleteForMe) {
    items.push({ id: 'delete-me', label: 'Delete for me', onClick: onDeleteForMe, danger: true })
  }

  if (isMine && canDeleteForEveryone) {
    items.push({
      id: 'delete-everyone',
      label: 'Delete for everyone',
      onClick: onDeleteForEveryone,
      danger: true,
    })
  }

  const menuWidth = 200
  const left = Math.min(x, window.innerWidth - menuWidth - 12)
  const top = Math.min(y, window.innerHeight - items.length * 44 - 12)

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] min-w-[12.5rem] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-xl"
      style={{ left, top }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={cn(
            'flex w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50',
            item.danger ? 'text-red-600' : 'text-gray-900',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
