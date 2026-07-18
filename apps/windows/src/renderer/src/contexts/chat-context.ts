import { createContext } from 'react'
import type {
  ChatConversationSummary,
  ChatGroupDto,
  ChatMessageDto,
  ChatUserSummary,
} from '@myinventory/shared'

export interface ChatNotification {
  partnerId?: string
  groupId?: string
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
  groups: ChatGroupDto[]
  messagesByPartner: Record<string, ChatMessageDto[]>
  messagesByGroup: Record<string, ChatMessageDto[]>
  activePartnerId: string | null
  activeGroupId: string | null
  isOnChatPage: boolean
  notifications: ChatNotification[]
  totalUnread: number
  liveUserIds: Set<string>
  isChatRoute: boolean
  setActivePartnerId: (partnerId: string | null) => void
  setActiveGroupId: (groupId: string | null) => void
  setChatPageActive: (active: boolean) => void
  isUserLive: (userId: string) => boolean
  getUserLastSeen: (userId: string) => string | null
  refreshUsers: () => Promise<void>
  refreshConversations: () => Promise<void>
  refreshGroups: () => Promise<void>
  loadMessages: (partnerId: string) => Promise<ChatMessageDto[]>
  loadGroupMessages: (groupId: string) => Promise<ChatMessageDto[]>
  markConversationRead: (partnerId: string) => Promise<void>
  markGroupRead: (groupId: string) => Promise<void>
  createGroup: (name: string, memberIds: string[]) => Promise<ChatGroupDto | null>
  addGroupMembers: (groupId: string, userIds: string[]) => Promise<ChatGroupDto | null>
  removeGroupMember: (groupId: string, userId: string) => Promise<ChatGroupDto | null>
  setGroupMemberCanSend: (
    groupId: string,
    userId: string,
    canSend: boolean,
  ) => Promise<ChatGroupDto | null>
  sendMessage: (
    recipientId: string,
    body: string,
    options?: { replyToMessageId?: string },
  ) => Promise<ChatMessageDto | null>
  sendGroupMessage: (
    groupId: string,
    body: string,
    options?: { replyToMessageId?: string },
  ) => Promise<ChatMessageDto | null>
  sendChatAttachment: (
    recipientId: string,
    file: File,
    options?: { body?: string; onProgress?: (loaded: number, total: number) => void },
  ) => Promise<ChatMessageDto | null>
  sendGroupChatAttachment: (
    groupId: string,
    file: File,
    options?: { body?: string; onProgress?: (loaded: number, total: number) => void },
  ) => Promise<ChatMessageDto | null>
  deleteMessageForMe: (partnerId: string, messageId: string) => Promise<void>
  deleteMessageForEveryone: (partnerId: string, messageId: string) => Promise<void>
  forwardMessage: (targetPartnerId: string, messageId: string) => Promise<ChatMessageDto | null>
  dismissNotification: (input: { partnerId?: string; groupId?: string }) => void
  clearNotifications: () => void
}

export const ChatContext = createContext<ChatContextValue | null>(null)
