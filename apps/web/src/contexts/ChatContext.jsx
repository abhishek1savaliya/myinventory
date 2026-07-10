'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { io } from 'socket.io-client'
import { AppFeature } from '@myinventory/shared'
import { API_BASE_URL, apiFetch } from '@/lib/api-client'
import { getStoredSessionId } from '@/lib/auth-storage'
import { playChatNotificationSound } from '@/lib/chat-sound'
import { useAuth } from '@/contexts/use-auth'
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

export function ChatProvider({ children }) {
  const { user, hasFeature } = useAuth()
  const pathname = usePathname()
  const socketRef = useRef(null)
  const activePartnerRef = useRef(null)
  const isOnChatPageRef = useRef(false)

  const [isConnected, setIsConnected] = useState(false)
  const [chatUsers, setChatUsers] = useState([])
  const [conversations, setConversations] = useState([])
  const [messagesByPartner, setMessagesByPartner] = useState({})
  const [activePartnerId, setActivePartnerIdState] = useState(null)
  const [isOnChatPage, setIsOnChatPage] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [totalUnread, setTotalUnread] = useState(0)

  const canUseChat = Boolean(user && hasFeature(AppFeature.CHAT))
  const isChatRoute = pathname?.includes('/chat') ?? false

  const setActivePartnerId = useCallback((partnerId) => {
    activePartnerRef.current = partnerId
    setActivePartnerIdState(partnerId)
  }, [])

  const setChatPageActive = useCallback((active) => {
    isOnChatPageRef.current = active
    setIsOnChatPage(active)
  }, [])

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

      setConversations((prev) =>
        prev.map((item) =>
          item.partnerId === partnerId ? { ...item, unreadCount: 0 } : item,
        ),
      )
      setTotalUnread((prev) => {
        const conversation = conversations.find((item) => item.partnerId === partnerId)
        return Math.max(0, prev - (conversation?.unreadCount ?? 0))
      })
      setNotifications((prev) => prev.filter((item) => item.partnerId !== partnerId))
    },
    [canUseChat, conversations],
  )

  const appendMessage = useCallback((message) => {
    const partnerId =
      message.senderId === user?.id ? message.recipientId : message.senderId

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
        message.senderId === user?.id
          ? { id: message.recipientId, name: message.recipientName ?? 'User' }
          : { id: message.senderId, name: message.senderName ?? 'User' }

      const next = prev.filter((item) => item.partnerId !== partnerId)
      const previous = prev.find((item) => item.partnerId === partnerId)
      const unreadCount =
        message.recipientId === user?.id &&
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
  }, [user?.id])

  const handleIncomingMessage = useCallback(
    (message) => {
      appendMessage(message)

      const isIncoming = message.recipientId === user?.id
      const partnerId = isIncoming ? message.senderId : message.recipientId
      const viewingConversation =
        isOnChatPageRef.current && activePartnerRef.current === partnerId

      if (isIncoming && !viewingConversation) {
        setTotalUnread((prev) => prev + 1)
        setNotifications((prev) =>
          upsertNotification(prev, {
            partnerId: message.senderId,
            partnerName: message.senderName ?? 'User',
            preview: message.body,
          }),
        )
        playChatNotificationSound()
      }

      if (isIncoming && viewingConversation) {
        void markConversationRead(partnerId)
      }
    },
    [appendMessage, markConversationRead, user?.id],
  )

  const sendMessage = useCallback(
    async (recipientId, body) => {
      if (!canUseChat || !recipientId || !body.trim()) {
        return null
      }

      const socket = socketRef.current
      if (socket?.connected) {
        return new Promise((resolve, reject) => {
          socket.emit('chat:send', { recipientId, body: body.trim() }, (response) => {
            if (!response?.ok) {
              reject(new Error(response?.error ?? 'Failed to send message'))
              return
            }
            resolve(response.data)
          })
        })
      }

      const response = await apiFetch(`/api/chat/messages/${recipientId}`, {
        method: 'POST',
        body: JSON.stringify({ body: body.trim() }),
      })
      appendMessage(response.data)
      return response.data
    },
    [appendMessage, canUseChat],
  )

  const dismissNotification = useCallback((partnerId) => {
    setNotifications((prev) => prev.filter((item) => item.partnerId !== partnerId))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  useEffect(() => {
    if (!canUseChat || !API_BASE_URL) {
      setIsConnected(false)
      return undefined
    }

    const sessionId = getStoredSessionId()
    if (!sessionId) return undefined

    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: { sessionId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      void refreshConversations()
      void refreshUsers()
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('chat:message', (message) => {
      handleIncomingMessage(message)
    })

    socket.on('chat:read', () => {
      void refreshConversations()
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [canUseChat, handleIncomingMessage, refreshConversations, refreshUsers])

  useEffect(() => {
    if (!canUseChat) {
      setChatUsers([])
      setConversations([])
      setMessagesByPartner({})
      setNotifications([])
      setTotalUnread(0)
      setActivePartnerId(null)
    }
  }, [canUseChat, setActivePartnerId])

  useEffect(() => {
    if (!isChatRoute && isOnChatPage) {
      setChatPageActive(false)
    }
  }, [isChatRoute, isOnChatPage, setChatPageActive])

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
      isChatRoute,
      setActivePartnerId,
      setChatPageActive,
      refreshUsers,
      refreshConversations,
      loadMessages,
      markConversationRead,
      sendMessage,
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
      isChatRoute,
      setActivePartnerId,
      setChatPageActive,
      refreshUsers,
      refreshConversations,
      loadMessages,
      markConversationRead,
      sendMessage,
      dismissNotification,
      clearNotifications,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
