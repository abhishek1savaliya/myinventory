import { prisma } from '@myinventory/prisma'
import type { ChatConversationSummary, ChatMessageDto } from '@myinventory/shared'
import { uploadChatAttachment } from '../../lib/chat-attachments.js'
import { AppError } from '../../middleware/error-handler.js'
import {
  isMessageHiddenForUser,
  mapChatMessageToDto,
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
    OR: [
      { senderId: userId, recipientId: partnerId, hiddenForSenderAt: null },
      { senderId: partnerId, recipientId: userId, hiddenForRecipientAt: null },
    ],
  } as {
    organizationId: string
    OR: Array<Record<string, unknown>>
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
    } as {
      organizationId: string
      senderId: string
      recipientId: string
      body: string
      replyToMessageId: string | null
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
      attachmentType: upload.type,
      attachmentUrl: upload.url,
      attachmentName: input.fileName,
      attachmentMimeType: input.mimeType,
      attachmentSize: upload.size,
    } as {
      organizationId: string
      senderId: string
      recipientId: string
      body: string
      attachmentType: string
      attachmentUrl: string
      attachmentName: string
      attachmentMimeType: string
      attachmentSize: number
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
      hiddenForRecipientAt: null,
      deletedForEveryoneAt: null,
    } as {
      organizationId: string
      recipientId: string
      readAt: null
      hiddenForRecipientAt: null
      deletedForEveryoneAt: null
    },
  })
}

export async function deleteChatMessageForMe(
  orgId: string,
  userId: string,
  messageId: string,
): Promise<{ messageId: string; partnerId: string }> {
  const message = await getMessageForParticipant(orgId, userId, messageId)
  const partnerId = message.senderId === userId ? message.recipientId : message.senderId
  const now = new Date()

  if (message.senderId === userId) {
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { hiddenForSenderAt: now } as { hiddenForSenderAt: Date },
    })
  } else {
    await prisma.chatMessage.update({
      where: { id: messageId },
      data: { hiddenForRecipientAt: now } as { hiddenForRecipientAt: Date },
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
    data: { deletedForEveryoneAt: new Date() } as { deletedForEveryoneAt: Date },
    include: messageInclude,
  })

  return {
    message: mapChatMessageToDto(updated),
    partnerId: message.recipientId,
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
    } as Record<string, unknown>,
    include: messageInclude,
  })

  return mapChatMessageToDto(message)
}
