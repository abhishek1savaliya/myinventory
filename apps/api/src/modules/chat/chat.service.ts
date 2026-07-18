import { ChatAttachmentType } from '@prisma/client'
import { prisma } from '@myinventory/prisma'
import type {
  ChatConversationSummary,
  ChatGroupDto,
  ChatGroupReadResult,
  ChatMessageDto,
  UserRole,
} from '@myinventory/shared'
import { uploadChatAttachment } from '../../lib/chat-attachments.js'
import { AppError } from '../../middleware/error-handler.js'
import {
  isMessageHiddenForUser,
  mapChatMessageToDto,
  mapChatGroupToDto,
  mapChatUserToSummary,
  mapConversationToSummary,
} from './chat.mapper.js'

const messageInclude = {
  sender: { select: { id: true, name: true, email: true, role: true } },
  recipient: { select: { id: true, name: true, email: true, role: true } },
  replyTo: {
    include: {
      sender: { select: { id: true, name: true } },
    },
  },
} as const

async function getMessageForParticipant(
  orgId: string,
  userId: string,
  messageId: string,
) {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      organizationId: orgId,
      groupId: null,
      OR: [{ senderId: userId }, { recipientId: userId }],
    },
    include: messageInclude,
  })

  if (!message || isMessageHiddenForUser(message, userId)) {
    throw new AppError(404, 'Message not found')
  }

  return message
}

function conversationMessageFilter(orgId: string, userId: string, partnerId: string) {
  return {
    organizationId: orgId,
    groupId: null,
    OR: [
      { senderId: userId, recipientId: partnerId, hiddenForSenderAt: null },
      { senderId: partnerId, recipientId: userId, hiddenForRecipientAt: null },
    ],
  }
}

async function assertChatPartner(orgId: string, partnerId: string, currentUserId: string) {
  if (partnerId === currentUserId) {
    throw new AppError(400, 'You cannot chat with yourself')
  }

  const partner = await prisma.user.findFirst({
    where: {
      id: partnerId,
      organizationId: orgId,
      status: 'ACTIVE',
    },
    select: { id: true, name: true, email: true, role: true },
  })

  if (!partner) {
    throw new AppError(404, 'Chat user not found')
  }

  return partner
}

export async function listChatUsers(orgId: string, currentUserId: string) {
  const users = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      status: 'ACTIVE',
      id: { not: currentUserId },
    },
    select: { id: true, name: true, email: true, role: true, chatLastSeenAt: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  })

  return users.map(mapChatUserToSummary)
}

export async function recordChatLastSeen(userId: string): Promise<string> {
  const now = new Date()
  await prisma.user.update({
    where: { id: userId },
    data: { chatLastSeenAt: now },
  })
  return now.toISOString()
}

export async function getOrgChatLastSeenMap(orgId: string): Promise<Record<string, string>> {
  const users = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      status: 'ACTIVE',
      chatLastSeenAt: { not: null },
    },
    select: { id: true, chatLastSeenAt: true },
  })

  return Object.fromEntries(
    users
      .filter((user) => user.chatLastSeenAt)
      .map((user) => [user.id, user.chatLastSeenAt!.toISOString()]),
  )
}

export async function listConversations(
  orgId: string,
  userId: string,
): Promise<ChatConversationSummary[]> {
  const recentMessages = await prisma.chatMessage.findMany({
    where: {
      organizationId: orgId,
      groupId: null,
      OR: [{ senderId: userId }, { recipientId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: messageInclude,
  })

  const unreadCounts = await prisma.chatMessage.groupBy({
    by: ['senderId'],
    where: {
      organizationId: orgId,
      groupId: null,
      recipientId: userId,
      readAt: null,
    },
    _count: { id: true },
  })

  const unreadBySender = new Map(
    unreadCounts.map((entry) => [entry.senderId, entry._count.id]),
  )

  const conversations = new Map<string, ChatConversationSummary>()

  for (const message of recentMessages) {
    if (isMessageHiddenForUser(message, userId)) continue

    const partner =
      message.senderId === userId ? message.recipient : message.sender
    if (!partner || conversations.has(partner.id)) continue

    conversations.set(
      partner.id,
      mapConversationToSummary({
        partner,
        lastMessage: mapChatMessageToDto(message),
        unreadCount: unreadBySender.get(partner.id) ?? 0,
      }),
    )
  }

  return [...conversations.values()].sort((a, b) => {
    const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
    const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
    return bTime - aTime
  })
}

export async function getConversationMessages(
  orgId: string,
  userId: string,
  partnerId: string,
  options: { limit: number; before?: string },
): Promise<ChatMessageDto[]> {
  await assertChatPartner(orgId, partnerId, userId)

  const messages = await prisma.chatMessage.findMany({
    where: {
      ...conversationMessageFilter(orgId, userId, partnerId),
      ...(options.before ? { createdAt: { lt: new Date(options.before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit,
    include: messageInclude,
  })

  return messages.reverse().map(mapChatMessageToDto)
}

export async function sendChatMessage(
  orgId: string,
  senderId: string,
  recipientId: string,
  body: string,
  replyToMessageId?: string,
): Promise<ChatMessageDto> {
  await assertChatPartner(orgId, recipientId, senderId)

  if (replyToMessageId) {
    const replyTarget = await getMessageForParticipant(orgId, senderId, replyToMessageId)
    const inConversation =
      (replyTarget.senderId === senderId && replyTarget.recipientId === recipientId) ||
      (replyTarget.senderId === recipientId && replyTarget.recipientId === senderId)

    if (!inConversation) {
      throw new AppError(400, 'Reply target is not in this conversation')
    }
  }

  const message = await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      senderId,
      recipientId,
      body,
      replyToMessageId: replyToMessageId ?? null,
    },
    include: messageInclude,
  })

  return mapChatMessageToDto(message)
}

export async function sendChatAttachmentMessage(
  orgId: string,
  senderId: string,
  recipientId: string,
  input: {
    buffer: Buffer
    mimeType: string
    fileName: string
    body?: string
  },
): Promise<ChatMessageDto> {
  await assertChatPartner(orgId, recipientId, senderId)

  const upload = await uploadChatAttachment({
    organizationId: orgId,
    buffer: input.buffer,
    mimeType: input.mimeType,
    fileName: input.fileName,
  })

  const caption = input.body?.trim() ?? ''

  const message = await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      senderId,
      recipientId,
      body: caption,
      attachmentType: upload.type as ChatAttachmentType,
      attachmentUrl: upload.url,
      attachmentName: input.fileName,
      attachmentMimeType: input.mimeType,
      attachmentSize: upload.size,
    },
    include: messageInclude,
  })

  return mapChatMessageToDto(message)
}

export async function markConversationRead(
  orgId: string,
  userId: string,
  partnerId: string,
): Promise<{ count: number; messageIds: string[]; readAt: string }> {
  await assertChatPartner(orgId, partnerId, userId)

  const unreadMessages = await prisma.chatMessage.findMany({
    where: {
      organizationId: orgId,
      senderId: partnerId,
      recipientId: userId,
      readAt: null,
    },
    select: { id: true },
  })

  const readAt = new Date()

  if (unreadMessages.length === 0) {
    return { count: 0, messageIds: [], readAt: readAt.toISOString() }
  }

  await prisma.chatMessage.updateMany({
    where: {
      organizationId: orgId,
      senderId: partnerId,
      recipientId: userId,
      readAt: null,
    },
    data: { readAt },
  })

  return {
    count: unreadMessages.length,
    messageIds: unreadMessages.map((message) => message.id),
    readAt: readAt.toISOString(),
  }
}

export async function markMessageDelivered(
  orgId: string,
  recipientId: string,
  messageId: string,
): Promise<ChatMessageDto | null> {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      organizationId: orgId,
      recipientId,
      deliveredAt: null,
    },
    include: messageInclude,
  })

  if (!message) {
    return null
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deliveredAt: new Date() },
    include: messageInclude,
  })

  return mapChatMessageToDto(updated)
}

export async function getTotalUnreadCount(orgId: string, userId: string): Promise<number> {
  const [directCount, memberships] = await Promise.all([
    prisma.chatMessage.count({
      where: {
        organizationId: orgId,
        groupId: null,
        recipientId: userId,
        readAt: null,
        hiddenForRecipientAt: null,
        deletedForEveryoneAt: null,
      },
    }),
    prisma.chatGroupMember.findMany({
      where: { userId, group: { organizationId: orgId } },
      select: { groupId: true, joinedAt: true, lastReadAt: true },
    }),
  ])

  const groupCounts = await Promise.all(
    memberships.map((membership) =>
      prisma.chatMessage.count({
        where: {
          groupId: membership.groupId,
          senderId: { not: userId },
          createdAt: { gt: membership.lastReadAt ?? membership.joinedAt },
          deletedForEveryoneAt: null,
        },
      }),
    ),
  )

  return directCount + groupCounts.reduce((total, count) => total + count, 0)
}

export async function deleteChatMessageForMe(
  orgId: string,
  userId: string,
  messageId: string,
): Promise<{ messageId: string; partnerId: string }> {
  const message = await getMessageForParticipant(orgId, userId, messageId)
  const partnerId = message.senderId === userId ? message.recipientId! : message.senderId
  const now = new Date()

  if (message.senderId === userId) {
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { hiddenForSenderAt: now },
    })
  } else {
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { hiddenForRecipientAt: now },
    })
  }

  return { messageId, partnerId }
}

export async function deleteChatMessageForEveryone(
  orgId: string,
  userId: string,
  messageId: string,
): Promise<{ message: ChatMessageDto; partnerId: string }> {
  const message = await getMessageForParticipant(orgId, userId, messageId)

  if (message.senderId !== userId) {
    throw new AppError(403, 'Only the sender can delete a message for everyone')
  }

  if (message.deletedForEveryoneAt) {
    throw new AppError(400, 'Message is already deleted for everyone')
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deletedForEveryoneAt: new Date() },
    include: messageInclude,
  })

  return {
    message: mapChatMessageToDto(updated),
    partnerId: message.recipientId!,
  }
}

export async function forwardChatMessage(
  orgId: string,
  senderId: string,
  recipientId: string,
  messageId: string,
): Promise<ChatMessageDto> {
  await assertChatPartner(orgId, recipientId, senderId)

  const original = await getMessageForParticipant(orgId, senderId, messageId)

  if (original.deletedForEveryoneAt) {
    throw new AppError(400, 'Cannot forward a deleted message')
  }

  const message = await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      senderId,
      recipientId,
      body: original.body,
      attachmentType: original.attachmentType,
      attachmentUrl: original.attachmentUrl,
      attachmentName: original.attachmentName,
      attachmentMimeType: original.attachmentMimeType,
      attachmentSize: original.attachmentSize,
      forwardedFromId: original.id,
    },
    include: messageInclude,
  })

  return mapChatMessageToDto(message)
}

const groupMemberInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      chatLastSeenAt: true,
    },
  },
} as const

const groupInclude = {
  members: {
    include: groupMemberInclude,
    orderBy: { joinedAt: 'asc' as const },
  },
} as const

function canManageGroups(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

async function assertGroupManager(orgId: string, role: UserRole, groupId: string) {
  if (!canManageGroups(role)) {
    throw new AppError(403, 'Only administrators and managers can manage chat groups')
  }

  const group = await prisma.chatGroup.findFirst({
    where: { id: groupId, organizationId: orgId },
    include: groupInclude,
  })

  if (!group) {
    throw new AppError(404, 'Chat group not found')
  }

  return group
}

async function assertGroupMembership(
  orgId: string,
  userId: string,
  groupId: string,
  requireSend = false,
) {
  const membership = await prisma.chatGroupMember.findFirst({
    where: {
      groupId,
      userId,
      group: { organizationId: orgId },
    },
    include: {
      group: { select: { id: true, name: true, organizationId: true } },
    },
  })

  if (!membership) {
    throw new AppError(403, 'You are not a member of this chat group')
  }

  if (requireSend && !membership.canSend) {
    throw new AppError(403, 'You are muted in this chat group')
  }

  return membership
}

async function assertActiveOrgUsers(orgId: string, userIds: string[]): Promise<string[]> {
  const uniqueIds = [...new Set(userIds)]
  if (uniqueIds.length === 0) return uniqueIds

  const users = await prisma.user.findMany({
    where: {
      id: { in: uniqueIds },
      organizationId: orgId,
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  if (users.length !== uniqueIds.length) {
    throw new AppError(400, 'All group members must be active users in your organization')
  }

  return uniqueIds
}

async function mapGroupWithActivity(
  group: Awaited<ReturnType<typeof prisma.chatGroup.findFirst>> & {
    members: Array<{
      canSend: boolean
      joinedAt: Date
      lastReadAt: Date | null
      user: {
        id: string
        name: string
        email: string
        role: string
        chatLastSeenAt: Date | null
      }
    }>
  },
  userId: string,
): Promise<ChatGroupDto> {
  const membership = group.members.find((member) => member.user.id === userId)
  const visibleSince = membership?.lastReadAt ?? membership?.joinedAt

  const [lastMessage, unreadCount] = await Promise.all([
    membership
      ? prisma.chatMessage.findFirst({
          where: {
            groupId: group.id,
            createdAt: { gte: membership.joinedAt },
          },
          orderBy: { createdAt: 'desc' },
          include: messageInclude,
        })
      : Promise.resolve(null),
    membership
      ? prisma.chatMessage.count({
          where: {
            groupId: group.id,
            senderId: { not: userId },
            createdAt: { gt: visibleSince! },
            deletedForEveryoneAt: null,
          },
        })
      : Promise.resolve(0),
  ])

  return mapChatGroupToDto(group, userId, { lastMessage, unreadCount })
}

export async function createChatGroup(
  orgId: string,
  creatorId: string,
  role: UserRole,
  input: { name: string; memberIds: string[] },
): Promise<ChatGroupDto> {
  if (!canManageGroups(role)) {
    throw new AppError(403, 'Only administrators and managers can create chat groups')
  }

  const memberIds = await assertActiveOrgUsers(orgId, [creatorId, ...input.memberIds])
  const group = await prisma.chatGroup.create({
    data: {
      organizationId: orgId,
      name: input.name,
      createdById: creatorId,
      members: {
        create: memberIds.map((userId) => ({ userId })),
      },
    },
    include: groupInclude,
  })

  return mapGroupWithActivity(group, creatorId)
}

export async function listChatGroups(
  orgId: string,
  userId: string,
  role: UserRole,
): Promise<ChatGroupDto[]> {
  const groups = await prisma.chatGroup.findMany({
    where: {
      organizationId: orgId,
      ...(canManageGroups(role) ? {} : { members: { some: { userId } } }),
    },
    include: groupInclude,
    orderBy: { updatedAt: 'desc' },
  })

  return Promise.all(groups.map((group) => mapGroupWithActivity(group, userId)))
}

export async function getChatGroup(
  orgId: string,
  userId: string,
  role: UserRole,
  groupId: string,
): Promise<ChatGroupDto> {
  const group = await prisma.chatGroup.findFirst({
    where: {
      id: groupId,
      organizationId: orgId,
      ...(canManageGroups(role) ? {} : { members: { some: { userId } } }),
    },
    include: groupInclude,
  })

  if (!group) {
    throw new AppError(404, 'Chat group not found')
  }

  return mapGroupWithActivity(group, userId)
}

export async function updateChatGroup(
  orgId: string,
  userId: string,
  role: UserRole,
  groupId: string,
  name: string,
): Promise<ChatGroupDto> {
  await assertGroupManager(orgId, role, groupId)
  const group = await prisma.chatGroup.update({
    where: { id: groupId },
    data: { name },
    include: groupInclude,
  })
  return mapGroupWithActivity(group, userId)
}

export async function addChatGroupMembers(
  orgId: string,
  actorId: string,
  role: UserRole,
  groupId: string,
  userIds: string[],
): Promise<{ group: ChatGroupDto; addedUserIds: string[] }> {
  await assertGroupManager(orgId, role, groupId)
  const validUserIds = await assertActiveOrgUsers(orgId, userIds)
  const existing = await prisma.chatGroupMember.findMany({
    where: { groupId, userId: { in: validUserIds } },
    select: { userId: true },
  })
  const existingIds = new Set(existing.map((member) => member.userId))
  const addedUserIds = validUserIds.filter((userId) => !existingIds.has(userId))

  if (addedUserIds.length > 0) {
    await prisma.chatGroupMember.createMany({
      data: addedUserIds.map((userId) => ({ groupId, userId })),
    })
  }

  return {
    group: await getChatGroup(orgId, actorId, role, groupId),
    addedUserIds,
  }
}

export async function removeChatGroupMember(
  orgId: string,
  actorId: string,
  role: UserRole,
  groupId: string,
  userId: string,
): Promise<{ group: ChatGroupDto; removedUserId: string }> {
  await assertGroupManager(orgId, role, groupId)
  const membership = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  })
  if (!membership) {
    throw new AppError(404, 'Group member not found')
  }

  await prisma.chatGroupMember.delete({ where: { id: membership.id } })
  return {
    group: await getChatGroup(orgId, actorId, role, groupId),
    removedUserId: userId,
  }
}

export async function updateChatGroupMemberCanSend(
  orgId: string,
  actorId: string,
  role: UserRole,
  groupId: string,
  userId: string,
  canSend: boolean,
): Promise<ChatGroupDto> {
  await assertGroupManager(orgId, role, groupId)
  const result = await prisma.chatGroupMember.updateMany({
    where: { groupId, userId },
    data: { canSend },
  })
  if (result.count === 0) {
    throw new AppError(404, 'Group member not found')
  }

  return getChatGroup(orgId, actorId, role, groupId)
}

export async function getChatGroupMessages(
  orgId: string,
  userId: string,
  groupId: string,
  options: { limit: number; before?: string },
): Promise<ChatMessageDto[]> {
  const membership = await assertGroupMembership(orgId, userId, groupId)
  const messages = await prisma.chatMessage.findMany({
    where: {
      groupId,
      organizationId: orgId,
      createdAt: {
        gte: membership.joinedAt,
        ...(options.before ? { lt: new Date(options.before) } : {}),
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit,
    include: messageInclude,
  })

  return messages.reverse().map(mapChatMessageToDto)
}

export async function sendChatGroupMessage(
  orgId: string,
  senderId: string,
  groupId: string,
  body: string,
  replyToMessageId?: string,
): Promise<ChatMessageDto> {
  const membership = await assertGroupMembership(orgId, senderId, groupId, true)

  if (replyToMessageId) {
    const replyTarget = await prisma.chatMessage.findFirst({
      where: {
        id: replyToMessageId,
        organizationId: orgId,
        groupId,
        createdAt: { gte: membership.joinedAt },
      },
      select: { id: true },
    })
    if (!replyTarget) {
      throw new AppError(400, 'Reply target is not in this group')
    }
  }

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        organizationId: orgId,
        senderId,
        groupId,
        recipientId: null,
        body,
        replyToMessageId: replyToMessageId ?? null,
      },
      include: messageInclude,
    }),
    prisma.chatGroup.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    }),
  ])

  return mapChatMessageToDto(message)
}

export async function sendChatGroupAttachmentMessage(
  orgId: string,
  senderId: string,
  groupId: string,
  input: {
    buffer: Buffer
    mimeType: string
    fileName: string
    body?: string
  },
): Promise<ChatMessageDto> {
  await assertGroupMembership(orgId, senderId, groupId, true)
  const upload = await uploadChatAttachment({
    organizationId: orgId,
    buffer: input.buffer,
    mimeType: input.mimeType,
    fileName: input.fileName,
  })

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        organizationId: orgId,
        senderId,
        groupId,
        recipientId: null,
        body: input.body?.trim() ?? '',
        attachmentType: upload.type as ChatAttachmentType,
        attachmentUrl: upload.url,
        attachmentName: input.fileName,
        attachmentMimeType: input.mimeType,
        attachmentSize: upload.size,
      },
      include: messageInclude,
    }),
    prisma.chatGroup.update({
      where: { id: groupId },
      data: { updatedAt: new Date() },
    }),
  ])

  return mapChatMessageToDto(message)
}

export async function markChatGroupRead(
  orgId: string,
  userId: string,
  groupId: string,
): Promise<ChatGroupReadResult> {
  const membership = await assertGroupMembership(orgId, userId, groupId)
  const since = membership.lastReadAt ?? membership.joinedAt
  const unreadMessages = await prisma.chatMessage.findMany({
    where: {
      organizationId: orgId,
      groupId,
      senderId: { not: userId },
      createdAt: { gt: since },
      deletedForEveryoneAt: null,
    },
    select: { id: true },
  })
  const readAt = new Date()

  await prisma.chatGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { lastReadAt: readAt },
  })

  return {
    count: unreadMessages.length,
    messageIds: unreadMessages.map((message) => message.id),
    readAt: readAt.toISOString(),
  }
}

export async function getChatGroupIdsForUser(orgId: string, userId: string): Promise<string[]> {
  const memberships = await prisma.chatGroupMember.findMany({
    where: { userId, group: { organizationId: orgId } },
    select: { groupId: true },
  })
  return memberships.map((membership) => membership.groupId)
}
