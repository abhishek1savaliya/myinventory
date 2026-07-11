// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import { AppFeature, getChatMessagePreview } from '@myinventory/shared'
import { API_BASE_URL, apiFetch, apiUploadFormData } from '@renderer/lib/api-client'
import { getStoredToken } from '@renderer/lib/auth-storage'
import { initChatAudio, playChatIncomingSound, playChatSentSound } from '@renderer/lib/chat-sound'
import { classifyChatFile } from '@renderer/lib/chat-attachment'
import { useAuth } from '@renderer/contexts/use-auth'
import { ChatContext } from './chat-context'

function upsertNotification(prev, { partnerId, partnerName, preview }) {
  const existing = prev.find((item) => item.partnerId === partnerId)

  if (existing) {
    return prev.map((item) =>
      item.partnerId === partnerId
        ? {
            ...item,
            count: item.count + 1,
            preview,
            updatedAt: Date.now(),
          }
        : item,
    )
  }

  return [
    ...prev,
    {
      partnerId,
      partnerName,
      preview,
      count: 1,
      updatedAt: Date.now(),
    },
  ]
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, hasFeature } = useAuth()
  const location = useLocation()
  const socketRef = useRef(null)
  const activePartnerRef = useRef(null)
  const isOnChatPageRef = useRef(false)
  const userIdRef = useRef(user?.id)

  const [isConnected, setIsConnected] = useState(false)
  const [chatUsers, setChatUsers] = useState([])
  const [conversations, setConversations] = useState([])
  const [messagesByPartner, setMessagesByPartner] = useState({})
  const [activePartnerId, setActivePartnerIdState] = useState(null)
  const [isOnChatPage, setIsOnChatPage] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [liveUserIds, setLiveUserIds] = useState(() => new Set())
  const [lastSeenByUserId, setLastSeenByUserId] = useState({})

  userIdRef.current = user?.id

  const canUseChat = Boolean(user && hasFeature(AppFeature.CHAT))
  const isChatRoute = location.pathname.includes('/chat')

  const setActivePartnerId = useCallback((partnerId) => {
    activePartnerRef.current = partnerId
    setActivePartnerIdState(partnerId)
  }, [])

  const emitPresence = useCallback((inChat) => {
    const socket = socketRef.current
    if (socket?.connected) {
      socket.emit('chat:presence', { inChat })
    }
  }, [])

  const setChatPageActive = useCallback(
    (active) => {
      isOnChatPageRef.current = active
      setIsOnChatPage(active)
      emitPresence(active)
    },
    [emitPresence],
  )

  const isUserLive = useCallback(
    (userId) => {
      if (!userId) return false
      return liveUserIds.has(userId)
    },
    [liveUserIds],
  )

  const getUserLastSeen = useCallback(
    (userId) => {
      if (!userId) return null
      return lastSeenByUserId[userId] ?? null
    },
    [lastSeenByUserId],
  )

  const refreshConversations = useCallback(async () => {
    if (!canUseChat) return

    try {
      const response = await apiFetch('/api/chat/conversations')
      setConversations(response.data)
      const unread = response.data.reduce((sum, item) => sum + item.unreadCount, 0)
      setTotalUnread(unread)
    } catch {
      setConversations([])
      setTotalUnread(0)
    }
  }, [canUseChat])

  const refreshUsers = useCallback(async () => {
    if (!canUseChat) return

    try {
      const response = await apiFetch('/api/chat/users')
      setChatUsers(response.data)
      setLastSeenByUserId((prev) => {
        const next = { ...prev }
        for (const chatUser of response.data) {
          if (chatUser.lastSeenAt) {
            next[chatUser.id] = chatUser.lastSeenAt
          }
        }
        return next
      })
    } catch {
      setChatUsers([])
    }
  }, [canUseChat])

  const loadMessages = useCallback(
    async (partnerId) => {
      if (!canUseChat || !partnerId) return []

      try {
        const response = await apiFetch(`/api/chat/messages/${partnerId}`)
        setMessagesByPartner((prev) => ({ ...prev, [partnerId]: response.data }))
        return response.data
      } catch {
        return []
      }
    },
    [canUseChat],
  )

  const markConversationRead = useCallback(
    async (partnerId) => {
      if (!canUseChat || !partnerId) return

      const socket = socketRef.current
      if (socket?.connected) {
        socket.emit('chat:mark-read', { partnerId })
      } else {
        await apiFetch(`/api/chat/messages/${partnerId}/read`, { method: 'POST' })
      }

      setConversations((prev) => {
        const unread = prev.find((item) => item.partnerId === partnerId)?.unreadCount ?? 0
        if (unread > 0) {
          setTotalUnread((total) => Math.max(0, total - unread))
        }
        return prev.map((item) =>
          item.partnerId === partnerId ? { ...item, unreadCount: 0 } : item,
        )
      })
      setNotifications((prev) => prev.filter((item) => item.partnerId !== partnerId))
    },
    [canUseChat],
  )

  const appendMessage = useCallback((message) => {
    const currentUserId = userIdRef.current
    const partnerId =
      message.senderId === currentUserId ? message.recipientId : message.senderId

    setMessagesByPartner((prev) => {
      const existing = prev[partnerId] ?? []
      if (existing.some((item) => item.id === message.id)) {
        return prev
      }
      return {
        ...prev,
        [partnerId]: [...existing, message],
      }
    })

    setConversations((prev) => {
      const partner =
        message.senderId === currentUserId
          ? { id: message.recipientId, name: message.recipientName ?? 'User' }
          : { id: message.senderId, name: message.senderName ?? 'User' }

      const next = prev.filter((item) => item.partnerId !== partnerId)
      const previous = prev.find((item) => item.partnerId === partnerId)
      const unreadCount =
        message.recipientId === currentUserId &&
        message.senderId === partnerId &&
        !(isOnChatPageRef.current && activePartnerRef.current === partnerId)
          ? (previous?.unreadCount ?? 0) + 1
          : previous?.unreadCount ?? 0

      return [
        {
          partnerId,
          partnerName: partner.name,
          partnerEmail: previous?.partnerEmail ?? '',
          partnerRole: previous?.partnerRole ?? '',
          lastMessage: message,
          unreadCount,
        },
        ...next,
      ]
    })
  }, [])

  const replaceOptimisticMessage = useCallback((partnerId, clientId, confirmed) => {
    const nextMessage = {
      ...confirmed,
      deliveredAt: confirmed.deliveredAt ?? null,
      readAt: confirmed.readAt ?? null,
      attachmentType: confirmed.attachmentType ?? null,
      attachmentUrl: confirmed.attachmentUrl ?? null,
      attachmentName: confirmed.attachmentName ?? null,
      attachmentMimeType: confirmed.attachmentMimeType ?? null,
      attachmentSize: confirmed.attachmentSize ?? null,
      replyToMessageId: confirmed.replyToMessageId ?? null,
      replyTo: confirmed.replyTo ?? null,
      forwardedFromId: confirmed.forwardedFromId ?? null,
      isDeletedForEveryone: confirmed.isDeletedForEveryone ?? false,
      clientStatus: 'sent',
    }

    setMessagesByPartner((prev) => ({
      ...prev,
      [partnerId]: (prev[partnerId] ?? []).map((item) =>
        item.id === clientId ? nextMessage : item,
      ),
    }))

    setConversations((prev) =>
      prev.map((item) =>
        item.partnerId === partnerId ? { ...item, lastMessage: nextMessage } : item,
      ),
    )
  }, [])

  const markOptimisticFailed = useCallback((partnerId, clientId) => {
    setMessagesByPartner((prev) => ({
      ...prev,
      [partnerId]: (prev[partnerId] ?? []).map((item) =>
        item.id === clientId ? { ...item, failed: true, clientStatus: 'failed' } : item,
      ),
    }))
  }, [])

  const applyMessageDelivered = useCallback((messageId, deliveredAt) => {
    setMessagesByPartner((prev) => {
      const next = {}

      for (const [partnerId, messages] of Object.entries(prev)) {
        next[partnerId] = messages.map((item) =>
          item.id === messageId
            ? { ...item, deliveredAt: deliveredAt ?? new Date().toISOString() }
            : item,
        )
      }

      return next
    })
  }, [])

  const applyMessagesRead = useCallback((partnerId, messageIds, readAt) => {
    const idSet = new Set(messageIds)

    setMessagesByPartner((prev) => ({
      ...prev,
      [partnerId]: (prev[partnerId] ?? []).map((item) =>
        idSet.has(item.id) ? { ...item, readAt: readAt ?? new Date().toISOString() } : item,
      ),
    }))
  }, [])

  const removeMessageFromPartner = useCallback((partnerId, messageId) => {
    setMessagesByPartner((prev) => ({
      ...prev,
      [partnerId]: (prev[partnerId] ?? []).filter((item) => item.id !== messageId),
    }))
  }, [])

  const applyMessageDeletedForEveryone = useCallback((partnerId, message) => {
    setMessagesByPartner((prev) => ({
      ...prev,
      [partnerId]: (prev[partnerId] ?? []).map((item) =>
        item.id === message.id ? { ...item, ...message, clientStatus: 'sent' } : item,
      ),
    }))

    setConversations((prev) =>
      prev.map((item) =>
        item.partnerId === partnerId && item.lastMessage?.id === message.id
          ? { ...item, lastMessage: message }
          : item,
      ),
    )
  }, [])

  const handleIncomingMessage = useCallback(
    (message) => {
      appendMessage(message)

      const currentUserId = userIdRef.current
      const isIncoming = message.recipientId === currentUserId
      const partnerId = isIncoming ? message.senderId : message.recipientId
      const viewingConversation =
        isOnChatPageRef.current && activePartnerRef.current === partnerId

      if (isIncoming) {
        socketRef.current?.emit('chat:delivered', { messageId: message.id })
      }

      if (isIncoming) {
        playChatIncomingSound({ inConversation: viewingConversation })
      }

      if (isIncoming && !viewingConversation) {
        setTotalUnread((prev) => prev + 1)
        setNotifications((prev) =>
          upsertNotification(prev, {
            partnerId: message.senderId,
            partnerName: message.senderName ?? 'User',
            preview: getChatMessagePreview(message),
          }),
        )
      }

      if (isIncoming && viewingConversation) {
        const socket = socketRef.current
        if (socket?.connected) {
          socket.emit('chat:mark-read', { partnerId })
        } else {
          void apiFetch(`/api/chat/messages/${partnerId}/read`, { method: 'POST' })
        }

        setConversations((prev) =>
          prev.map((item) =>
            item.partnerId === partnerId ? { ...item, unreadCount: 0 } : item,
          ),
        )
        setNotifications((prev) => prev.filter((item) => item.partnerId !== partnerId))
      }
    },
    [appendMessage],
  )

  const sendMessage = useCallback(
    async (recipientId, body, { replyToMessageId } = {}) => {
      const trimmed = body.trim()
      const currentUserId = userIdRef.current

      if (!canUseChat || !recipientId || !trimmed || !currentUserId) {
        return null
      }

      const clientId = `temp-${crypto.randomUUID()}`
      const optimistic = {
        id: clientId,
        senderId: currentUserId,
        recipientId,
        body: trimmed,
        createdAt: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
        attachmentType: null,
        attachmentUrl: null,
        attachmentName: null,
        attachmentMimeType: null,
        attachmentSize: null,
        replyToMessageId: replyToMessageId ?? null,
        replyTo: null,
        forwardedFromId: null,
        isDeletedForEveryone: false,
        clientStatus: 'sending',
      }

      appendMessage(optimistic)
      playChatSentSound()

      const payload = { body: trimmed, ...(replyToMessageId ? { replyToMessageId } : {}) }

      try {
        const socket = socketRef.current
        if (socket?.connected) {
          const confirmed = await new Promise((resolve, reject) => {
            socket.emit('chat:send', { recipientId, ...payload }, (response) => {
              if (!response?.ok) {
                reject(new Error(response?.error ?? 'Failed to send message'))
                return
              }
              resolve(response.data)
            })
          })
          replaceOptimisticMessage(recipientId, clientId, confirmed)
          return confirmed
        }

        const response = await apiFetch(`/api/chat/messages/${recipientId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        replaceOptimisticMessage(recipientId, clientId, response.data)
        return response.data
      } catch (error) {
        markOptimisticFailed(recipientId, clientId)
        throw error
      }
    },
    [appendMessage, canUseChat, markOptimisticFailed, replaceOptimisticMessage],
  )

  const sendChatAttachment = useCallback(
    async (recipientId, file, { body = '', onProgress } = {}) => {
      const currentUserId = userIdRef.current

      if (!canUseChat || !recipientId || !file || !currentUserId) {
        return null
      }

      const clientId = `temp-${crypto.randomUUID()}`
      const previewUrl = URL.createObjectURL(file)
      const optimistic = {
        id: clientId,
        senderId: currentUserId,
        recipientId,
        body: body.trim(),
        createdAt: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
        attachmentType: classifyChatFile(file),
        attachmentUrl: previewUrl,
        attachmentName: file.name,
        attachmentMimeType: file.type || 'application/octet-stream',
        attachmentSize: file.size,
        clientStatus: 'sending',
      }

      appendMessage(optimistic)
      playChatSentSound()

      const formData = new FormData()
      formData.append('file', file)
      if (body.trim()) {
        formData.append('body', body.trim())
      }

      try {
        const response = await apiUploadFormData(
          `/api/chat/messages/${recipientId}/attachment`,
          formData,
          onProgress,
        )
        URL.revokeObjectURL(previewUrl)
        replaceOptimisticMessage(recipientId, clientId, response.data)
        return response.data
      } catch (error) {
        URL.revokeObjectURL(previewUrl)
        markOptimisticFailed(recipientId, clientId)
        throw error
      }
    },
    [appendMessage, canUseChat, markOptimisticFailed, replaceOptimisticMessage],
  )

  const deleteMessageForMe = useCallback(
    async (partnerId, messageId) => {
      if (!canUseChat || !partnerId || !messageId || messageId.startsWith('temp-')) return

      await apiFetch(`/api/chat/messages/${messageId}/for-me`, { method: 'DELETE' })
      removeMessageFromPartner(partnerId, messageId)
    },
    [canUseChat, removeMessageFromPartner],
  )

  const deleteMessageForEveryone = useCallback(
    async (partnerId, messageId) => {
      if (!canUseChat || !partnerId || !messageId || messageId.startsWith('temp-')) return

      const response = await apiFetch(`/api/chat/messages/${messageId}/for-everyone`, {
        method: 'DELETE',
      })
      applyMessageDeletedForEveryone(partnerId, response.data)
    },
    [applyMessageDeletedForEveryone, canUseChat],
  )

  const forwardMessage = useCallback(
    async (targetPartnerId, messageId) => {
      if (!canUseChat || !targetPartnerId || !messageId || messageId.startsWith('temp-')) {
        return null
      }

      const response = await apiFetch(`/api/chat/messages/${targetPartnerId}/forward`, {
        method: 'POST',
        body: JSON.stringify({ messageId }),
      })

      const message = response.data
      const partnerId =
        message.senderId === userIdRef.current ? message.recipientId : message.senderId
      appendMessage(message)

      if (isOnChatPageRef.current && activePartnerRef.current === partnerId) {
        playChatSentSound()
      }

      return message
    },
    [appendMessage, canUseChat],
  )

  const dismissNotification = useCallback((partnerId) => {
    setNotifications((prev) => prev.filter((item) => item.partnerId !== partnerId))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const refreshConversationsRef = useRef(refreshConversations)
  const refreshUsersRef = useRef(refreshUsers)
  const handleIncomingMessageRef = useRef(handleIncomingMessage)
  const applyMessageDeliveredRef = useRef(applyMessageDelivered)
  const applyMessagesReadRef = useRef(applyMessagesRead)

  const applyMessageDeletedForEveryoneRef = useRef(applyMessageDeletedForEveryone)

  refreshConversationsRef.current = refreshConversations
  refreshUsersRef.current = refreshUsers
  handleIncomingMessageRef.current = handleIncomingMessage
  applyMessageDeliveredRef.current = applyMessageDelivered
  applyMessagesReadRef.current = applyMessagesRead
  applyMessageDeletedForEveryoneRef.current = applyMessageDeletedForEveryone

  useEffect(() => {
    if (!canUseChat || !API_BASE_URL) {
      setIsConnected(false)
      return undefined
    }

    const token = getStoredToken()
    if (!token) return undefined

    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })

    socketRef.current = socket

    const onConnect = () => {
      setIsConnected(true)
      if (isOnChatPageRef.current) {
        socket.emit('chat:presence', { inChat: true })
      }
      void refreshConversationsRef.current()
      void refreshUsersRef.current()
    }

    const onDisconnect = () => {
      setIsConnected(false)
    }

    const onMessage = (message) => {
      handleIncomingMessageRef.current(message)
    }

    const onRead = (payload) => {
      if (payload?.partnerId && Array.isArray(payload.messageIds)) {
        applyMessagesReadRef.current(
          payload.partnerId,
          payload.messageIds,
          payload.readAt,
        )
      }
      void refreshConversationsRef.current()
    }

    const onDelivered = (payload) => {
      if (payload?.messageId) {
        applyMessageDeliveredRef.current(payload.messageId, payload.deliveredAt)
      }
    }

    const onMessageDeleted = (payload) => {
      if (payload?.scope !== 'everyone' || !payload.message) return

      const currentUserId = userIdRef.current
      const partnerId =
        payload.message.senderId === currentUserId
          ? payload.message.recipientId
          : payload.message.senderId

      applyMessageDeletedForEveryoneRef.current(partnerId, payload.message)
    }

    const onPresenceSync = ({ liveUserIds: nextLiveUserIds, lastSeenByUserId: nextLastSeen }) => {
      setLiveUserIds(new Set(Array.isArray(nextLiveUserIds) ? nextLiveUserIds : []))
      if (nextLastSeen && typeof nextLastSeen === 'object') {
        setLastSeenByUserId((prev) => ({ ...prev, ...nextLastSeen }))
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('chat:message', onMessage)
    socket.on('chat:read', onRead)
    socket.on('chat:delivered', onDelivered)
    socket.on('chat:message-deleted', onMessageDeleted)
    socket.on('chat:presence:sync', onPresenceSync)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('chat:message', onMessage)
      socket.off('chat:read', onRead)
      socket.off('chat:delivered', onDelivered)
      socket.off('chat:message-deleted', onMessageDeleted)
      socket.off('chat:presence:sync', onPresenceSync)

      if (isOnChatPageRef.current) {
        socket.emit('chat:presence', { inChat: false })
      }

      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [canUseChat, user?.id])

  useEffect(() => {
    if (!canUseChat) {
      setChatUsers([])
      setConversations([])
      setMessagesByPartner({})
      setNotifications([])
      setTotalUnread(0)
      setActivePartnerId(null)
      setLiveUserIds(new Set())
    }
  }, [canUseChat, setActivePartnerId])

  useEffect(() => {
    if (!isChatRoute && isOnChatPage) {
      setChatPageActive(false)
    }
  }, [isChatRoute, isOnChatPage, setChatPageActive])

  useEffect(() => {
    if (!canUseChat) return undefined

    const warmUpAudio = () => {
      initChatAudio()
    }

    document.addEventListener('pointerdown', warmUpAudio, { once: true })
    return () => {
      document.removeEventListener('pointerdown', warmUpAudio)
    }
  }, [canUseChat])

  const value = useMemo(
    () => ({
      isConnected,
      canUseChat,
      chatUsers,
      conversations,
      messagesByPartner,
      activePartnerId,
      isOnChatPage,
      notifications,
      totalUnread,
      liveUserIds,
      isChatRoute,
      setActivePartnerId,
      setChatPageActive,
      isUserLive,
      getUserLastSeen,
      refreshUsers,
      refreshConversations,
      loadMessages,
      markConversationRead,
      sendMessage,
      sendChatAttachment,
      deleteMessageForMe,
      deleteMessageForEveryone,
      forwardMessage,
      dismissNotification,
      clearNotifications,
    }),
    [
      isConnected,
      canUseChat,
      chatUsers,
      conversations,
      messagesByPartner,
      activePartnerId,
      isOnChatPage,
      notifications,
      totalUnread,
      liveUserIds,
      isChatRoute,
      setActivePartnerId,
      setChatPageActive,
      isUserLive,
      getUserLastSeen,
      refreshUsers,
      refreshConversations,
      loadMessages,
      markConversationRead,
      sendMessage,
      sendChatAttachment,
      deleteMessageForMe,
      deleteMessageForEveryone,
      forwardMessage,
      dismissNotification,
      clearNotifications,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
