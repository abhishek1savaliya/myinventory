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
  role: string
}

export interface ChatMessageDto {
  id: string
  senderId: string
  recipientId: string
  body: string
  createdAt: string
  deliveredAt: string | null
  readAt: string | null
  attachmentType: ChatAttachmentType | null
  attachmentUrl: string | null
  attachmentName: string | null
  attachmentMimeType: string | null
  attachmentSize: number | null
  senderName?: string
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
  const text = message.body?.trim()
  if (text) return text

  if (message.attachmentType === ChatAttachmentType.IMAGE) return 'Photo'
  if (message.attachmentType === ChatAttachmentType.VIDEO) return 'Video'
  if (message.attachmentType === ChatAttachmentType.FILE) {
    return message.attachmentName ? `File: ${message.attachmentName}` : 'File'
  }

  return ''
}

export interface ChatConversationSummary {
  partnerId: string
  partnerName: string
  partnerEmail: string
  partnerRole: string
  lastMessage: ChatMessageDto | null
  unreadCount: number
}
