import type { ChatMessage } from '@prisma/client'
import type {
  ChatConversationSummary,
  ChatGroupDto,
  ChatGroupMemberDto,
  ChatMessageDto,
  ChatUserSummary,
} from '@myinventory/shared'
import { getChatMessagePreview } from '@myinventory/shared'

type MessageSource = ChatMessage & {
  deliveredAt?: Date | null
  attachmentType?: string | null
  attachmentUrl?: string | null
  attachmentName?: string | null
  attachmentMimeType?: string | null
  attachmentSize?: number | null
  replyToMessageId?: string | null
  forwardedFromId?: string | null
  deletedForEveryoneAt?: Date | null
  hiddenForSenderAt?: Date | null
  hiddenForRecipientAt?: Date | null
  sender?: { id?: string; name: string; profilePhotoUrl?: string | null }
  recipient?: { name: string } | null
  replyTo?:
    | (ChatMessage & {
        deletedForEveryoneAt?: Date | null
        attachmentType?: string | null
        sender?: { id?: string; name: string }
      })
    | null
}

function mapReplyPreview(
  replyTo: NonNullable<MessageSource['replyTo']>,
): ChatMessageDto['replyTo'] {
  const isDeleted = Boolean(replyTo.deletedForEveryoneAt)

  return {
    id: replyTo.id,
    body: isDeleted ? 'This message was deleted' : replyTo.body,
    senderId: replyTo.senderId,
    senderName: replyTo.sender?.name,
    attachmentType: isDeleted
      ? null
      : ((replyTo.attachmentType as ChatMessageDto['attachmentType']) ?? null),
    isDeletedForEveryone: isDeleted,
  }
}

export function mapChatMessageToDto(message: MessageSource): ChatMessageDto {
  const isDeletedForEveryone = Boolean(message.deletedForEveryoneAt)

  return {
    id: message.id,
    senderId: message.senderId,
    recipientId: message.recipientId ?? null,
    groupId: message.groupId ?? null,
    body: isDeletedForEveryone ? '' : message.body,
    createdAt: message.createdAt.toISOString(),
    deliveredAt: message.deliveredAt?.toISOString() ?? null,
    readAt: message.readAt?.toISOString() ?? null,
    attachmentType: isDeletedForEveryone
      ? null
      : ((message.attachmentType as ChatMessageDto['attachmentType']) ?? null),
    attachmentUrl: isDeletedForEveryone ? null : (message.attachmentUrl ?? null),
    attachmentName: isDeletedForEveryone ? null : (message.attachmentName ?? null),
    attachmentMimeType: isDeletedForEveryone ? null : (message.attachmentMimeType ?? null),
    attachmentSize: isDeletedForEveryone ? null : (message.attachmentSize ?? null),
    replyToMessageId: message.replyToMessageId ?? null,
    replyTo: message.replyTo ? mapReplyPreview(message.replyTo) : null,
    forwardedFromId: message.forwardedFromId ?? null,
    isDeletedForEveryone,
    senderName: message.sender?.name,
    senderProfilePhotoUrl: message.sender?.profilePhotoUrl ?? null,
    recipientName: message.recipient?.name,
  }
}

export function isMessageHiddenForUser(
  message: { senderId: string; recipientId: string | null; hiddenForSenderAt?: Date | null; hiddenForRecipientAt?: Date | null },
  userId: string,
): boolean {
  if (message.senderId === userId && message.hiddenForSenderAt) return true
  if (message.recipientId === userId && message.hiddenForRecipientAt) return true
  return false
}

type GroupMemberSource = {
  canSend: boolean
  joinedAt: Date
  lastReadAt: Date | null
  user: {
    id: string
    name: string
    email: string
    profilePhotoUrl?: string | null
    role: string
    chatLastSeenAt?: Date | null
  }
}

export function mapChatGroupMemberToDto(member: GroupMemberSource): ChatGroupMemberDto {
  return {
    user: mapChatUserToSummary(member.user),
    canSend: member.canSend,
    joinedAt: member.joinedAt.toISOString(),
    lastReadAt: member.lastReadAt?.toISOString() ?? null,
  }
}

export function mapChatGroupToDto(
  group: {
    id: string
    organizationId: string
    name: string
    photoUrl: string | null
    createdById: string
    createdAt: Date
    updatedAt: Date
    members: GroupMemberSource[]
  },
  currentUserId: string,
  options: {
    lastMessage?: MessageSource | null
    unreadCount?: number
  } = {},
): ChatGroupDto {
  const members = group.members.map(mapChatGroupMemberToDto)

  return {
    id: group.id,
    organizationId: group.organizationId,
    name: group.name,
    photoUrl: group.photoUrl,
    createdById: group.createdById,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    members,
    currentMember: members.find((member) => member.user.id === currentUserId) ?? null,
    lastMessage: options.lastMessage ? mapChatMessageToDto(options.lastMessage) : null,
    unreadCount: options.unreadCount ?? 0,
  }
}

export function mapChatUserToSummary(user: {
  id: string
  name: string
  email: string
    profilePhotoUrl?: string | null
  role: string
  chatLastSeenAt?: Date | null
}): ChatUserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profilePhotoUrl: user.profilePhotoUrl ?? null,
    role: user.role,
    lastSeenAt: user.chatLastSeenAt?.toISOString() ?? null,
  }
}

export function mapConversationToSummary(input: {
  partner: { id: string; name: string; email: string; profilePhotoUrl?: string | null; role: string }
  lastMessage: ChatMessageDto | null
  unreadCount: number
}): ChatConversationSummary {
  return {
    partnerId: input.partner.id,
    partnerName: input.partner.name,
    partnerEmail: input.partner.email,
    partnerProfilePhotoUrl: input.partner.profilePhotoUrl ?? null,
    partnerRole: input.partner.role,
    lastMessage: input.lastMessage,
    unreadCount: input.unreadCount,
  }
}

export function getMessagePreviewFromDto(message: ChatMessageDto): string {
  return getChatMessagePreview(message)
}
