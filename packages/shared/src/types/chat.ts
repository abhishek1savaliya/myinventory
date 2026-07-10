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

export interface ChatConversationSummary {
  partnerId: string
  partnerName: string
  partnerEmail: string
  partnerRole: string
  lastMessage: ChatMessageDto | null
  unreadCount: number
}
