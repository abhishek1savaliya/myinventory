import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import type { Socket } from 'socket.io'
import { AppFeature, getEffectiveFeatures, sendChatMessageSchema } from '@myinventory/shared'
import type { ChatMessageDto } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { loadSession } from '../../lib/session-storage.js'
import { verifyAccessToken } from '../../utils/jwt.js'
import { markConversationRead, markMessageDelivered, sendChatMessage } from './chat.service.js'

interface ChatSocketUser {
  sub: string
  orgId: string
  name: string
}

interface ChatSocket extends Socket {
  data: {
    user: ChatSocketUser
    inChat?: boolean
  }
}

let chatIo: Server | null = null
const presenceCounts = new Map<string, Map<string, number>>()

function changeChatPresence(orgId: string, userId: string, delta: number): string[] {
  if (!presenceCounts.has(orgId)) {
    presenceCounts.set(orgId, new Map())
  }

  const orgPresence = presenceCounts.get(orgId)!
  const current = orgPresence.get(userId) ?? 0
  const next = Math.max(0, current + delta)

  if (next === 0) {
    orgPresence.delete(userId)
  } else {
    orgPresence.set(userId, next)
  }

  return [...orgPresence.keys()]
}

function getLiveUserIds(orgId: string): string[] {
  return [...(presenceCounts.get(orgId)?.keys() ?? [])]
}

function broadcastPresence(orgId: string): void {
  if (!chatIo) return
  chatIo.to(`org:${orgId}`).emit('chat:presence:sync', {
    liveUserIds: getLiveUserIds(orgId),
  })
}

function setSocketChatPresence(socket: ChatSocket, inChat: boolean): void {
  const user = socket.data.user
  const wasInChat = socket.data.inChat ?? false
  if (wasInChat === inChat) return

  socket.data.inChat = inChat
  changeChatPresence(user.orgId, user.sub, inChat ? 1 : -1)
  broadcastPresence(user.orgId)
}

export function initChatSocket(httpServer: HttpServer): Server {
  chatIo = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: '/socket.io',
  })

  chatIo.use(async (socket, next) => {
    try {
      const sessionId =
        (typeof socket.handshake.auth?.sessionId === 'string'
          ? socket.handshake.auth.sessionId
          : undefined) ?? socket.handshake.headers['x-session-id']?.toString()

      if (!sessionId) {
        next(new Error('Authentication required'))
        return
      }

      const session = await loadSession(sessionId)
      if (!session) {
        next(new Error('Session expired or invalid'))
        return
      }

      const payload = verifyAccessToken(session.token)
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          status: true,
          organizationId: true,
          role: true,
          extraFeatures: true,
          name: true,
        },
      })

      if (!user || user.status !== 'ACTIVE') {
        next(new Error('User account is inactive or does not exist'))
        return
      }

      if (payload.orgId && user.organizationId !== payload.orgId) {
        next(new Error('Organization context is invalid'))
        return
      }

      const features = getEffectiveFeatures(user.role, user.extraFeatures as AppFeature[])
      if (!features.includes(AppFeature.CHAT)) {
        next(new Error('You do not have permission to use chat'))
        return
      }

      ;(socket as ChatSocket).data.user = {
        sub: user.id,
        orgId: user.organizationId,
        name: user.name,
      }

      next()
    } catch {
      next(new Error('Authentication failed'))
    }
  })

  chatIo.on('connection', (socket: ChatSocket) => {
    const user = socket.data.user
    socket.data.inChat = false
    void socket.join(`user:${user.sub}`)
    void socket.join(`org:${user.orgId}`)

    socket.emit('chat:presence:sync', { liveUserIds: getLiveUserIds(user.orgId) })

    socket.on('chat:presence', (payload) => {
      if (!payload || typeof payload.inChat !== 'boolean') return
      setSocketChatPresence(socket, payload.inChat)
    })

    socket.on('disconnect', () => {
      if (socket.data.inChat) {
        changeChatPresence(user.orgId, user.sub, -1)
        broadcastPresence(user.orgId)
      }
    })

    socket.on('chat:send', async (payload, ack) => {
      try {
        const parsed = sendChatMessageSchema.safeParse(payload)
        if (!parsed.success || typeof payload?.recipientId !== 'string') {
          ack?.({ ok: false, error: 'Invalid message payload' })
          return
        }

        const message = await sendChatMessage(
          user.orgId,
          user.sub,
          payload.recipientId,
          parsed.data.body,
        )

        emitChatMessage(message)
        ack?.({ ok: true, data: message })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send message'
        ack?.({ ok: false, error: message })
      }
    })

    socket.on('chat:mark-read', async (payload, ack) => {
      try {
        if (!payload || typeof payload.partnerId !== 'string') {
          ack?.({ ok: false, error: 'Invalid read payload' })
          return
        }

        const result = await markConversationRead(user.orgId, user.sub, payload.partnerId)
        emitChatRead(payload.partnerId, user.sub, result)
        ack?.({ ok: true, data: result })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to mark messages read'
        ack?.({ ok: false, error: message })
      }
    })

    socket.on('chat:delivered', async (payload) => {
      if (!payload || typeof payload.messageId !== 'string') return

      const message = await markMessageDelivered(user.orgId, user.sub, payload.messageId)
      if (!message) return

      chatIo?.to(`user:${message.senderId}`).emit('chat:delivered', {
        messageId: message.id,
        deliveredAt: message.deliveredAt,
      })
    })
  })

  return chatIo
}

export function emitChatMessage(message: ChatMessageDto): void {
  if (!chatIo) return

  // Sender already gets the saved message from the send ack.
  chatIo.to(`user:${message.recipientId}`).emit('chat:message', message)
}

export function emitChatRead(
  senderId: string,
  readerId: string,
  result: { count: number; messageIds: string[]; readAt: string },
): void {
  if (!chatIo || result.count === 0) return

  chatIo.to(`user:${senderId}`).emit('chat:read', {
    partnerId: readerId,
    messageIds: result.messageIds,
    readAt: result.readAt,
    count: result.count,
  })
}

export function getChatIo(): Server | null {
  return chatIo
}
