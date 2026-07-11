import { Download, FileText } from 'lucide-react'
import { ChatAttachmentType, getChatMessagePreview } from '@myinventory/shared'
import { formatFileSize } from '@renderer/lib/chat-attachment'
import { cn } from '@renderer/lib/utils'

function ReplyPreview({ replyTo, isMine }) {
  if (!replyTo) return null

  return (
    <div
      className={cn(
        'mb-2 rounded-md border-l-2 px-2 py-1 text-xs',
        isMine ? 'border-white/70 bg-white/10 text-white/90' : 'border-[var(--color-primary)] bg-gray-50 text-[var(--color-muted)]',
      )}
    >
      <p className={cn('font-semibold', !isMine && 'text-[var(--color-primary)]')}>
        {replyTo.senderName ?? 'User'}
      </p>
      <p className="truncate">{getChatMessagePreview(replyTo)}</p>
    </div>
  )
}

export function ChatMessageContent({ message, isMine }) {
  if (message.isDeletedForEveryone) {
    return (
      <p className={cn('italic opacity-80', isMine ? 'text-white/85' : 'text-[var(--color-muted)]')}>
        This message was deleted
      </p>
    )
  }

  const hasAttachment = Boolean(message.attachmentType && message.attachmentUrl)

  return (
    <div className="space-y-2">
      <ReplyPreview replyTo={message.replyTo} isMine={isMine} />

      {message.forwardedFromId && (
        <p className={cn('text-[10px] font-medium uppercase tracking-wide opacity-75')}>
          Forwarded
        </p>
      )}

      {hasAttachment && (
        <div className="overflow-hidden rounded-lg">
          {message.attachmentType === ChatAttachmentType.IMAGE && (
            <a
              href={message.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={message.attachmentUrl}
                alt={message.attachmentName || 'Image'}
                className="max-h-64 w-full rounded-lg object-cover"
              />
            </a>
          )}

          {message.attachmentType === ChatAttachmentType.VIDEO && (
            <video
              src={message.attachmentUrl}
              controls
              className="max-h-72 w-full rounded-lg bg-black"
              preload="metadata"
              onClick={(event) => event.stopPropagation()}
            >
              <track kind="captions" />
            </video>
          )}

          {message.attachmentType === ChatAttachmentType.FILE && (
            <a
              href={message.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={message.attachmentName || undefined}
              onClick={(event) => event.stopPropagation()}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                isMine
                  ? 'border-white/20 bg-white/10 hover:bg-white/15'
                  : 'border-[var(--color-border)] bg-gray-50 hover:bg-gray-100',
              )}
            >
              <FileText className="h-8 w-8 shrink-0 opacity-80" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{message.attachmentName || 'File'}</p>
                <p className="text-xs opacity-80">{formatFileSize(message.attachmentSize)}</p>
              </div>
              <Download className="ml-auto h-4 w-4 shrink-0 opacity-70" />
            </a>
          )}
        </div>
      )}

      {message.body?.trim() ? (
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
      ) : null}
    </div>
  )
}
