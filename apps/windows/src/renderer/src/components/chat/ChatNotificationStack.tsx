import { Link } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import { useChat } from '@renderer/contexts/use-chat'
import { cn } from '@renderer/lib/utils'

export function ChatNotificationStack() {
  const { canUseChat, notifications, dismissNotification, totalUnread } = useChat()

  if (!canUseChat || notifications.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-6 right-4 z-50 flex w-[min(100vw-2rem,22rem)] flex-col gap-2">
      {notifications.map((notification) => {
        const key = notification.groupId
          ? `group:${notification.groupId}`
          : `dm:${notification.partnerId}`
        const href = notification.groupId
          ? `/chat?group=${notification.groupId}`
          : `/chat?user=${notification.partnerId}`
        const dismissPayload = notification.groupId
          ? { groupId: notification.groupId }
          : { partnerId: notification.partnerId }

        return (
          <div
            key={key}
            className="pointer-events-auto overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl ring-1 ring-black/5 transition-transform duration-300"
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
                    onClick={() => dismissNotification(dismissPayload)}
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
                  to={href}
                  onClick={() => dismissNotification(dismissPayload)}
                  className={cn(
                    'mt-2 inline-flex text-xs font-medium text-[var(--color-primary)] hover:underline',
                  )}
                >
                  Open chat
                </Link>
              </div>
            </div>
          </div>
        )
      })}

      {notifications.length > 1 && (
        <p className="pointer-events-none text-right text-xs font-medium text-[var(--color-muted)]">
          {totalUnread} unread message{totalUnread === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}
