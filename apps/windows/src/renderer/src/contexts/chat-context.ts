import { createContext } from 'react'
import type {
  ChatConversationSummary,
  ChatMessageDto,
  ChatUserSummary,
} from '@myinventory/shared'

export interface ChatNotification {
  partnerId: string
  partnerName: string
  preview: string
  count: number
  updatedAt: number
}

export interface ChatContextValue {
  isConnected: boolean
  canUseChat: boolean
  chatUsers: ChatUserSummary[]
  conversations: ChatConversationSummary[]
  messagesByPartner: Record<string, ChatMessageDto[]>
  activePartnerId: string | null
  isOnChatPage: boolean
  notifications: ChatNotification[]
  totalUnread: number
  liveUserIds: Set<string>
  isChatRoute: boolean
  setActivePartnerId: (partnerId: string | null) => void
  setChatPageActive: (active: boolean) => void
  isUserLive: (userId: string) => boolean
  getUserLastSeen: (userId: string) => string | null
  refreshUsers: () => Promise<void>
  refreshConversations: () => Promise<void>
  loadMessages: (partnerId: string) => Promise<ChatMessageDto[]>
  markConversationRead: (partnerId: string) => Promise<void>
  sendMessage: (
    recipientId: string,
    body: string,
    options?: { replyToMessageId?: string },
  ) => Promise<ChatMessageDto | null>
  sendChatAttachment: (
    recipientId: string,
    file: File,
    options?: { body?: string; onProgress?: (loaded: number, total: number) => void },
  ) => Promise<ChatMessageDto | null>
  deleteMessageForMe: (partnerId: string, messageId: string) => Promise<void>
  deleteMessageForEveryone: (partnerId: string, messageId: string) => Promise<void>
  forwardMessage: (targetPartnerId: string, messageId: string) => Promise<ChatMessageDto | null>
  dismissNotification: (partnerId: string) => void
  clearNotifications: () => void
}

export const ChatContext = createContext<ChatContextValue | null>(null)
