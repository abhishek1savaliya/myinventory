'use client'

import { Download, FileText } from 'lucide-react'
import { ChatAttachmentType } from '@myinventory/shared'
import { formatFileSize } from '@/lib/chat-attachment'
import { cn } from '@/lib/utils'

export function ChatMessageContent({ message, isMine }) {
  const hasAttachment = Boolean(message.attachmentType && message.attachmentUrl)

  return (
    <div className="space-y-2">
      {hasAttachment && (
        <div className="overflow-hidden rounded-lg">
          {message.attachmentType === ChatAttachmentType.IMAGE && (
            <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer">
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
