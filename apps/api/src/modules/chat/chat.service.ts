import { prisma } from '@myinventory/prisma'
import type { ChatConversationSummary, ChatMessageDto } from '@myinventory/shared'
import { AppError } from '../../middleware/error-handler.js'
import {
  mapChatMessageToDto,
  mapChatUserToSummary,
  mapConversationToSummary,
} from './chat.mapper.js'

const messageInclude = {
  sender: { select: { id: true, name: true, email: true, role: true } },
  recipient: { select: { id: true, name: true, email: true, role: true } },
} as const

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
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  })

  return users.map(mapChatUserToSummary)
}

export async function listConversations(
  orgId: string,
  userId: string,
): Promise<ChatConversationSummary[]> {
  const recentMessages = await prisma.chatMessage.findMany({
    where: {
      organizationId: orgId,
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
      organizationId: orgId,
      OR: [
        { senderId: userId, recipientId: partnerId },
        { senderId: partnerId, recipientId: userId },
      ],
      ...(options.before
        ? { createdAt: { lt: new Date(options.before) } }
        : {}),
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
): Promise<ChatMessageDto> {
  await assertChatPartner(orgId, recipientId, senderId)

  const message = await prisma.chatMessage.create({
    data: {
      organizationId: orgId,
      senderId,
      recipientId,
      body,
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
    } as {
      id: string
      organizationId: string
      recipientId: string
      deliveredAt: null
    },
    include: messageInclude,
  })

  if (!message) {
    return null
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { deliveredAt: new Date() } as { deliveredAt: Date },
    include: messageInclude,
  })

  return mapChatMessageToDto(updated)
}

export async function getTotalUnreadCount(orgId: string, userId: string): Promise<number> {
  return prisma.chatMessage.count({
    where: {
      organizationId: orgId,
      recipientId: userId,
      readAt: null,
    },
  })
}
