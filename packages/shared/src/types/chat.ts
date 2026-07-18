export enum ChatAttachmentType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
}

export const CHAT_MAX_IMAGE_BYTES = 6 * 1024 * 1024
export const CHAT_MAX_VIDEO_BYTES = 100 * 1024 * 1024
export const CHAT_MAX_FILE_BYTES = 10 * 1024 * 1024

export interface ChatUserSummary {
  id: string
  name: string
  email: string
  profilePhotoUrl: string | null
  role: string
  lastSeenAt: string | null
}

export interface ChatMessageReplyPreview {
  id: string
  body: string
  senderId: string
  senderName?: string
  attachmentType: ChatAttachmentType | null
  isDeletedForEveryone: boolean
}

export interface ChatMessageDto {
  id: string
  senderId: string
  recipientId: string | null
  groupId: string | null
  body: string
  createdAt: string
  deliveredAt: string | null
  readAt: string | null
  attachmentType: ChatAttachmentType | null
  attachmentUrl: string | null
  attachmentName: string | null
  attachmentMimeType: string | null
  attachmentSize: number | null
  replyToMessageId: string | null
  replyTo: ChatMessageReplyPreview | null
  forwardedFromId: string | null
  isDeletedForEveryone: boolean
  senderName?: string
  senderProfilePhotoUrl?: string | null
  recipientName?: string
}

export type ChatDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

export function getChatDeliveryStatus(
  message: ChatMessageDto & { clientStatus?: ChatDeliveryStatus; failed?: boolean },
): ChatDeliveryStatus {
  if (message.failed || message.clientStatus === 'failed') return 'failed'
  if (message.clientStatus === 'sending' || message.id.startsWith('temp-')) return 'sending'
  if (message.readAt) return 'read'
  if (message.deliveredAt) return 'delivered'
  return 'sent'
}

export function getChatMessagePreview(message: ChatMessageDto): string {
  if (message.isDeletedForEveryone) return 'This message was deleted'

  const text = message.body?.trim()
  if (text) return text

  if (message.attachmentType === ChatAttachmentType.IMAGE) return 'Photo'
  if (message.attachmentType === ChatAttachmentType.VIDEO) return 'Video'
  if (message.attachmentType === ChatAttachmentType.FILE) {
    return message.attachmentName ? `File: ${message.attachmentName}` : 'File'
  }

  return ''
}

export function formatChatLastSeen(iso: string, now = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))

  if (diffSec < 60) return 'just now'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export const CHAT_USER_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#059669',
  '#0891b2',
  '#4f46e5',
] as const

export function getChatUserColor(userId = ''): string {
  let hash = 0
  for (let index = 0; index < userId.length; index += 1) {
    hash = ((hash << 5) - hash + userId.charCodeAt(index)) | 0
  }
  return CHAT_USER_COLORS[Math.abs(hash) % CHAT_USER_COLORS.length]
}

export interface ChatConversationSummary {
  partnerId: string
  partnerName: string
  partnerEmail: string
  partnerProfilePhotoUrl: string | null
  partnerRole: string
  lastMessage: ChatMessageDto | null
  unreadCount: number
}

export interface ChatGroupMemberDto {
  user: ChatUserSummary
  canSend: boolean
  joinedAt: string
  lastReadAt: string | null
}

export interface ChatGroupDto {
  id: string
  organizationId: string
  name: string
  createdById: string
  createdAt: string
  updatedAt: string
  members: ChatGroupMemberDto[]
  currentMember: ChatGroupMemberDto | null
  lastMessage: ChatMessageDto | null
  unreadCount: number
}

export interface ChatGroupReadResult {
  count: number
  messageIds: string[]
  readAt: string
}
