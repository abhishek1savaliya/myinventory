'use client'

import Link from 'next/link'
import { MessageCircle, X } from 'lucide-react'
import { useChat } from '@/contexts/use-chat'
import { useAuth } from '@/contexts/use-auth'
import { orgPath } from '@/lib/org-paths'
import { cn } from '@/lib/utils'

export function ChatNotificationStack() {
  const { orgSlug } = useAuth()
  const { canUseChat, notifications, dismissNotification, totalUnread } = useChat()

  if (!canUseChat || notifications.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-[min(100vw-2rem,22rem)] flex-col gap-2 lg:bottom-6">
      {notifications.map((notification) => (
        <div
          key={notification.partnerId}
          className="pointer-events-auto overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
        >
          <div className="flex items-start gap-3 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {notification.partnerName}
                  </p>
                  <p className="text-xs font-medium text-[var(--color-primary)]">
                    {notification.count === 1
                      ? '1 new message'
                      : `${notification.count} new messages`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissNotification(notification.partnerId)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">
                {notification.preview}
              </p>
              <Link
                href={orgPath(orgSlug, `/chat?user=${notification.partnerId}`)}
                onClick={() => dismissNotification(notification.partnerId)}
                className={cn(
                  'mt-2 inline-flex text-xs font-medium text-[var(--color-primary)] hover:underline',
                )}
              >
                Open chat
              </Link>
            </div>
          </div>
        </div>
      ))}

      {notifications.length > 1 && (
        <p className="pointer-events-none text-right text-xs font-medium text-[var(--color-muted)]">
          {totalUnread} unread message{totalUnread === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}
