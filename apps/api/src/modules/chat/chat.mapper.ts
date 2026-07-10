import type { ChatMessage } from '@prisma/client'
import type { ChatConversationSummary, ChatMessageDto, ChatUserSummary } from '@myinventory/shared'

export function mapChatMessageToDto(
  message: ChatMessage & {
    deliveredAt?: Date | null
    sender?: { name: string }
    recipient?: { name: string }
  },
): ChatMessageDto {
  return {
    id: message.id,
    senderId: message.senderId,
    recipientId: message.recipientId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    deliveredAt: message.deliveredAt?.toISOString() ?? null,
    readAt: message.readAt?.toISOString() ?? null,
    senderName: message.sender?.name,
    recipientName: message.recipient?.name,
  }
}

export function mapChatUserToSummary(user: {
  id: string
  name: string
  email: string
  role: string
}): ChatUserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

export function mapConversationToSummary(input: {
  partner: { id: string; name: string; email: string; role: string }
  lastMessage: ChatMessageDto | null
  unreadCount: number
}): ChatConversationSummary {
  return {
    partnerId: input.partner.id,
    partnerName: input.partner.name,
    partnerEmail: input.partner.email,
    partnerRole: input.partner.role,
    lastMessage: input.lastMessage,
    unreadCount: input.unreadCount,
  }
}
