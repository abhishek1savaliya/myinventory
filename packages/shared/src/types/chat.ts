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
  readAt: string | null
  senderName?: string
  recipientName?: string
}

export interface ChatConversationSummary {
  partnerId: string
  partnerName: string
  partnerEmail: string
  partnerRole: string
  lastMessage: ChatMessageDto | null
  unreadCount: number
}
