/* eslint-disable @typescript-eslint/ban-ts-comment -- matches existing chat provider style */
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

function notificationMatches(item, { partnerId, groupId }) {
  if (groupId) return item.groupId === groupId
  if (partnerId) return item.partnerId === partnerId && !item.groupId
  return false
}

function upsertNotification(prev, { partnerId, groupId, partnerName, preview }) {
  const existing = prev.find((item) => notificationMatches(item, { partnerId, groupId }))

  if (existing) {
    return prev.map((item) =>
      notificationMatches(item, { partnerId, groupId })
        ? {
            ...item,
            count: item.count + 1,
            preview,
            partnerName,
            updatedAt: Date.now(),
          }
        : item,
    )
  }

  return [
    ...prev,
    {
      partnerId,
      groupId,
      partnerName,
      preview,
      count: 1,
      updatedAt: Date.now(),
    },
  ]
}

function sumUnread(conversations, groups) {
  const dmUnread = conversations.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0)
  const groupUnread = groups.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0)
  return dmUnread + groupUnread
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, hasFeature } = useAuth()
  const location = useLocation()
  const socketRef = useRef(null)
  const activePartnerRef = useRef(null)
  const activeGroupRef = useRef(null)
  const isOnChatPageRef = useRef(false)
  const userIdRef = useRef(user?.id)
  const conversationsRef = useRef([])
  const groupsRef = useRef([])

  const [isConnected, setIsConnected] = useState(false)
  const [chatUsers, setChatUsers] = useState([])
  const [conversations, setConversations] = useState([])
  const [groups, setGroups] = useState([])
  const [messagesByPartner, setMessagesByPartner] = useState({})
  const [messagesByGroup, setMessagesByGroup] = useState({})
  const [activePartnerId, setActivePartnerIdState] = useState(null)
  const [activeGroupId, setActiveGroupIdState] = useState(null)
  const [isOnChatPage, setIsOnChatPage] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [liveUserIds, setLiveUserIds] = useState(() => new Set())
  const [lastSeenByUserId, setLastSeenByUserId] = useState({})

  userIdRef.current = user?.id
  conversationsRef.current = conversations
  groupsRef.current = groups

  const canUseChat = Boolean(user && hasFeature(AppFeature.CHAT))
  const isChatRoute = location.pathname.includes('/chat')

  const setActivePartnerId = useCallback((partnerId) => {
    activePartnerRef.current = partnerId
    setActivePartnerIdState(partnerId)
    if (partnerId) {
      activeGroupRef.current = null
      setActiveGroupIdState(null)
    }
  }, [])

  const setActiveGroupId = useCallback((groupId) => {
    activeGroupRef.current = groupId
    setActiveGroupIdState(groupId)
    if (groupId) {
      activePartnerRef.current = null
      setActivePartnerIdState(null)
    }
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
      conversationsRef.current = response.data
      setTotalUnread(sumUnread(response.data, groupsRef.current))
    } catch {
      setConversations([])
      conversationsRef.current = []
      setTotalUnread(sumUnread([], groupsRef.current))
    }
  }, [canUseChat])

  const refreshGroups = useCallback(async () => {
    if (!canUseChat) return

    try {
      const response = await apiFetch('/api/chat/groups')
      const nextGroups = Array.isArray(response.data) ? response.data : []
      setGroups(nextGroups)
      groupsRef.current = nextGroups
      setTotalUnread(sumUnread(conversationsRef.current, nextGroups))
    } catch {
      setGroups([])
      groupsRef.current = []
      setTotalUnread(sumUnread(conversationsRef.current, []))
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

  const loadGroupMessages = useCallback(
    async (groupId) => {
      if (!canUseChat || !groupId) return []

      try {
        const response = await apiFetch(`/api/chat/groups/${groupId}/messages`)
        setMessagesByGroup((prev) => ({ ...prev, [groupId]: response.data }))
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
        const next = prev.map((item) =>
          item.partnerId === partnerId ? { ...item, unreadCount: 0 } : item,
        )
        conversationsRef.current = next
        return next
      })
      setNotifications((prev) => prev.filter((item) => !notificationMatches(item, { partnerId })))
    },
    [canUseChat],
  )

  const markGroupRead = useCallback(
    async (groupId) => {
      if (!canUseChat || !groupId) return

      const socket = socketRef.current
      try {
        if (socket?.connected) {
          socket.emit('chat:group:mark-read', { groupId })
        } else {
          await apiFetch(`/api/chat/groups/${groupId}/read`, { method: 'POST' })
        }
      } catch {
        return
      }

      setGroups((prev) => {
        const unread = prev.find((item) => item.id === groupId)?.unreadCount ?? 0
        if (unread > 0) {
          setTotalUnread((total) => Math.max(0, total - unread))
        }
        const next = prev.map((item) =>
          item.id === groupId ? { ...item, unreadCount: 0 } : item,
        )
        groupsRef.current = next
        return next
      })
      setNotifications((prev) => prev.filter((item) => !notificationMatches(item, { groupId })))
    },
    [canUseChat],
  )

  const upsertGroup = useCallback((group) => {
    setGroups((prev) => {
      const next = [group, ...prev.filter((item) => item.id !== group.id)]
      groupsRef.current = next
      setTotalUnread(sumUnread(conversationsRef.current, next))
      return next
    })
  }, [])

  const appendMessage = useCallback((message) => {
    const currentUserId = userIdRef.current
    const partnerId =
      message.senderId === currentUserId ? message.recipientId : message.senderId

    if (!partnerId) return

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

      const updated = [
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
      conversationsRef.current = updated
      setTotalUnread(sumUnread(updated, groupsRef.current))
      return updated
    })
  }, [])

  const appendGroupMessage = useCallback((message) => {
    const groupId = message.groupId
    if (!groupId) return

    const currentUserId = userIdRef.current
    const isIncoming = message.senderId !== currentUserId

    setMessagesByGroup((prev) => {
      const existing = prev[groupId] ?? []
      if (existing.some((item) => item.id === message.id)) {
        return prev
      }
      return {
        ...prev,
        [groupId]: [...existing, message],
      }
    })

    setGroups((prev) => {
      const previous = prev.find((item) => item.id === groupId)
      const viewingGroup =
        isOnChatPageRef.current && activeGroupRef.current === groupId
      const unreadCount =
        isIncoming && !viewingGroup
          ? (previous?.unreadCount ?? 0) + 1
          : previous?.unreadCount ?? 0

      const updatedGroup = previous
        ? { ...previous, lastMessage: message, unreadCount }
        : {
            id: groupId,
            organizationId: '',
            name: 'Group',
            createdById: '',
            createdAt: message.createdAt,
            updatedAt: message.createdAt,
            members: [],
            currentMember: null,
            lastMessage: message,
            unreadCount,
          }

      const next = [updatedGroup, ...prev.filter((item) => item.id !== groupId)]
      groupsRef.current = next
      setTotalUnread(sumUnread(conversationsRef.current, next))
      return next
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

    setConversations((prev) => {
      const next = prev.map((item) =>
        item.partnerId === partnerId ? { ...item, lastMessage: nextMessage } : item,
      )
      conversationsRef.current = next
      return next
    })
  }, [])

  const replaceOptimisticGroupMessage = useCallback((groupId, clientId, confirmed) => {
    const nextMessage = {
      ...confirmed,
      groupId,
      recipientId: confirmed.recipientId ?? null,
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

    setMessagesByGroup((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] ?? []).map((item) =>
        item.id === clientId ? nextMessage : item,
      ),
    }))

    setGroups((prev) => {
      const next = prev.map((item) =>
        item.id === groupId ? { ...item, lastMessage: nextMessage } : item,
      )
      groupsRef.current = next
      return next
    })
  }, [])

  const markOptimisticFailed = useCallback((partnerId, clientId) => {
    setMessagesByPartner((prev) => ({
      ...prev,
      [partnerId]: (prev[partnerId] ?? []).map((item) =>
        item.id === clientId ? { ...item, failed: true, clientStatus: 'failed' } : item,
      ),
    }))
  }, [])

  const markOptimisticGroupFailed = useCallback((groupId, clientId) => {
    setMessagesByGroup((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] ?? []).map((item) =>
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

    setConversations((prev) => {
      const next = prev.map((item) =>
        item.partnerId === partnerId && item.lastMessage?.id === message.id
          ? { ...item, lastMessage: message }
          : item,
      )
      conversationsRef.current = next
      return next
    })
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

        setConversations((prev) => {
          const next = prev.map((item) =>
            item.partnerId === partnerId ? { ...item, unreadCount: 0 } : item,
          )
          conversationsRef.current = next
          setTotalUnread(sumUnread(next, groupsRef.current))
          return next
        })
        setNotifications((prev) => prev.filter((item) => !notificationMatches(item, { partnerId })))
      }
    },
    [appendMessage],
  )

  const handleIncomingGroupMessage = useCallback(
    (message) => {
      if (!message?.groupId) return

      appendGroupMessage(message)

      const currentUserId = userIdRef.current
      const isIncoming = message.senderId !== currentUserId
      const groupId = message.groupId
      const viewingGroup = isOnChatPageRef.current && activeGroupRef.current === groupId
      const groupName =
        groupsRef.current.find((item) => item.id === groupId)?.name ?? 'Group'

      if (isIncoming) {
        playChatIncomingSound({ inConversation: viewingGroup })
      }

      if (isIncoming && !viewingGroup) {
        setNotifications((prev) =>
          upsertNotification(prev, {
            groupId,
            partnerName: groupName,
            preview: `${message.senderName ?? 'User'}: ${getChatMessagePreview(message)}`,
          }),
        )
      }

      if (isIncoming && viewingGroup) {
        const socket = socketRef.current
        if (socket?.connected) {
          socket.emit('chat:group:mark-read', { groupId })
        } else {
          void apiFetch(`/api/chat/groups/${groupId}/read`, { method: 'POST' })
        }

        setGroups((prev) => {
          const next = prev.map((item) =>
            item.id === groupId ? { ...item, unreadCount: 0 } : item,
          )
          groupsRef.current = next
          setTotalUnread(sumUnread(conversationsRef.current, next))
          return next
        })
        setNotifications((prev) => prev.filter((item) => !notificationMatches(item, { groupId })))
      }
    },
    [appendGroupMessage],
  )

  const handleGroupMembershipUpdated = useCallback(
    (payload) => {
      if (!payload?.groupId) return

      const currentUserId = userIdRef.current
      const removed = Array.isArray(payload.removedUserIds)
        ? payload.removedUserIds.includes(currentUserId)
        : false

      if (removed) {
        setGroups((prev) => {
          const next = prev.filter((item) => item.id !== payload.groupId)
          groupsRef.current = next
          setTotalUnread(sumUnread(conversationsRef.current, next))
          return next
        })
        setMessagesByGroup((prev) => {
          const next = { ...prev }
          delete next[payload.groupId]
          return next
        })
        if (activeGroupRef.current === payload.groupId) {
          activeGroupRef.current = null
          setActiveGroupIdState(null)
        }
        setNotifications((prev) =>
          prev.filter((item) => !notificationMatches(item, { groupId: payload.groupId })),
        )
        return
      }

      void refreshGroups()
    },
    [refreshGroups],
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
        groupId: null,
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

  const sendGroupMessage = useCallback(
    async (groupId, body, { replyToMessageId } = {}) => {
      const trimmed = body.trim()
      const currentUserId = userIdRef.current

      if (!canUseChat || !groupId || !trimmed || !currentUserId) {
        return null
      }

      const clientId = `temp-${crypto.randomUUID()}`
      const optimistic = {
        id: clientId,
        senderId: currentUserId,
        recipientId: null,
        groupId,
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
        senderName: user?.name,
        clientStatus: 'sending',
      }

      appendGroupMessage(optimistic)
      playChatSentSound()

      const payload = {
        groupId,
        body: trimmed,
        ...(replyToMessageId ? { replyToMessageId } : {}),
      }

      try {
        const socket = socketRef.current
        if (socket?.connected) {
          const confirmed = await new Promise((resolve, reject) => {
            socket.emit('chat:group:send', payload, (response) => {
              if (!response?.ok) {
                reject(new Error(response?.error ?? 'Failed to send group message'))
                return
              }
              resolve(response.data)
            })
          })
          replaceOptimisticGroupMessage(groupId, clientId, confirmed)
          return confirmed
        }

        const response = await apiFetch(`/api/chat/groups/${groupId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            body: trimmed,
            ...(replyToMessageId ? { replyToMessageId } : {}),
          }),
        })
        replaceOptimisticGroupMessage(groupId, clientId, response.data)
        return response.data
      } catch (error) {
        markOptimisticGroupFailed(groupId, clientId)
        throw error
      }
    },
    [
      appendGroupMessage,
      canUseChat,
      markOptimisticGroupFailed,
      replaceOptimisticGroupMessage,
      user?.name,
    ],
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
        groupId: null,
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

  const sendGroupChatAttachment = useCallback(
    async (groupId, file, { body = '', onProgress } = {}) => {
      const currentUserId = userIdRef.current

      if (!canUseChat || !groupId || !file || !currentUserId) {
        return null
      }

      const clientId = `temp-${crypto.randomUUID()}`
      const previewUrl = URL.createObjectURL(file)
      const optimistic = {
        id: clientId,
        senderId: currentUserId,
        recipientId: null,
        groupId,
        body: body.trim(),
        createdAt: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
        attachmentType: classifyChatFile(file),
        attachmentUrl: previewUrl,
        attachmentName: file.name,
        attachmentMimeType: file.type || 'application/octet-stream',
        attachmentSize: file.size,
        senderName: user?.name,
        clientStatus: 'sending',
      }

      appendGroupMessage(optimistic)
      playChatSentSound()

      const formData = new FormData()
      formData.append('file', file)
      if (body.trim()) {
        formData.append('body', body.trim())
      }

      try {
        const response = await apiUploadFormData(
          `/api/chat/groups/${groupId}/messages/attachment`,
          formData,
          onProgress,
        )
        URL.revokeObjectURL(previewUrl)
        replaceOptimisticGroupMessage(groupId, clientId, response.data)
        return response.data
      } catch (error) {
        URL.revokeObjectURL(previewUrl)
        markOptimisticGroupFailed(groupId, clientId)
        throw error
      }
    },
    [
      appendGroupMessage,
      canUseChat,
      markOptimisticGroupFailed,
      replaceOptimisticGroupMessage,
      user?.name,
    ],
  )

  const createGroup = useCallback(
    async (name, memberIds) => {
      if (!canUseChat) return null

      const response = await apiFetch('/api/chat/groups', {
        method: 'POST',
        body: JSON.stringify({ name, memberIds }),
      })
      upsertGroup(response.data)
      return response.data
    },
    [canUseChat, upsertGroup],
  )

  const addGroupMembers = useCallback(
    async (groupId, userIds) => {
      if (!canUseChat || !groupId || !userIds?.length) return null

      const response = await apiFetch(`/api/chat/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userIds }),
      })
      upsertGroup(response.data)
      return response.data
    },
    [canUseChat, upsertGroup],
  )

  const removeGroupMember = useCallback(
    async (groupId, userId) => {
      if (!canUseChat || !groupId || !userId) return null

      const response = await apiFetch(`/api/chat/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
      })
      upsertGroup(response.data)
      return response.data
    },
    [canUseChat, upsertGroup],
  )

  const setGroupMemberCanSend = useCallback(
    async (groupId, userId, canSend) => {
      if (!canUseChat || !groupId || !userId) return null

      const response = await apiFetch(`/api/chat/groups/${groupId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ canSend }),
      })
      upsertGroup(response.data)
      return response.data
    },
    [canUseChat, upsertGroup],
  )

  const updateGroupPhoto = useCallback(
    async (groupId, photo) => {
      if (!canUseChat || !groupId) return null

      const response = photo
        ? await apiUploadFormData(
            `/api/chat/groups/${groupId}/photo`,
            (() => {
              const formData = new FormData()
              formData.append('photo', photo, 'group-photo.jpg')
              return formData
            })(),
          )
        : await apiFetch(`/api/chat/groups/${groupId}/photo`, { method: 'DELETE' })

      upsertGroup(response.data)
      return response.data
    },
    [canUseChat, upsertGroup],
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

  const dismissNotification = useCallback((input) => {
    setNotifications((prev) => prev.filter((item) => !notificationMatches(item, input)))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const refreshConversationsRef = useRef(refreshConversations)
  const refreshUsersRef = useRef(refreshUsers)
  const refreshGroupsRef = useRef(refreshGroups)
  const handleIncomingMessageRef = useRef(handleIncomingMessage)
  const handleIncomingGroupMessageRef = useRef(handleIncomingGroupMessage)
  const handleGroupMembershipUpdatedRef = useRef(handleGroupMembershipUpdated)
  const applyMessageDeliveredRef = useRef(applyMessageDelivered)
  const applyMessagesReadRef = useRef(applyMessagesRead)
  const applyMessageDeletedForEveryoneRef = useRef(applyMessageDeletedForEveryone)

  refreshConversationsRef.current = refreshConversations
  refreshUsersRef.current = refreshUsers
  refreshGroupsRef.current = refreshGroups
  handleIncomingMessageRef.current = handleIncomingMessage
  handleIncomingGroupMessageRef.current = handleIncomingGroupMessage
  handleGroupMembershipUpdatedRef.current = handleGroupMembershipUpdated
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
      void refreshGroupsRef.current()
    }

    const onDisconnect = () => {
      setIsConnected(false)
    }

    const onMessage = (message) => {
      handleIncomingMessageRef.current(message)
    }

    const onGroupMessage = (message) => {
      handleIncomingGroupMessageRef.current(message)
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

    const onGroupRead = () => {
      void refreshGroupsRef.current()
    }

    const onGroupMembershipUpdated = (payload) => {
      handleGroupMembershipUpdatedRef.current(payload)
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

      if (partnerId) {
        applyMessageDeletedForEveryoneRef.current(partnerId, payload.message)
      }
    }

    const onPresenceSync = ({ liveUserIds: nextLiveUserIds, lastSeenByUserId: nextLastSeen }) => {
      setLiveUserIds(new Set(Array.isArray(nextLiveUserIds) ? nextLiveUserIds : []))
      if (nextLastSeen && typeof nextLastSeen === 'object') {
        setLastSeenByUserId((prev) => ({ ...prev, ...nextLastSeen }))
      }
    }

    const onUserDisabled = (payload) => {
      const removedId = payload?.userId
      if (removedId) {
        if (activePartnerRef.current === removedId) {
          setActivePartnerId(null)
        }
        setMessagesByPartner((prev) => {
          if (!prev[removedId]) return prev
          const next = { ...prev }
          delete next[removedId]
          return next
        })
        setNotifications((prev) => prev.filter((item) => !notificationMatches(item, { partnerId: removedId })))
      }
      void refreshUsersRef.current()
      void refreshConversationsRef.current()
      void refreshGroupsRef.current()
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('chat:message', onMessage)
    socket.on('chat:group:message', onGroupMessage)
    socket.on('chat:read', onRead)
    socket.on('chat:group:read', onGroupRead)
    socket.on('chat:group:membership-updated', onGroupMembershipUpdated)
    socket.on('chat:delivered', onDelivered)
    socket.on('chat:message-deleted', onMessageDeleted)
    socket.on('chat:user-disabled', onUserDisabled)
    socket.on('chat:presence:sync', onPresenceSync)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('chat:message', onMessage)
      socket.off('chat:group:message', onGroupMessage)
      socket.off('chat:read', onRead)
      socket.off('chat:group:read', onGroupRead)
      socket.off('chat:group:membership-updated', onGroupMembershipUpdated)
      socket.off('chat:delivered', onDelivered)
      socket.off('chat:message-deleted', onMessageDeleted)
      socket.off('chat:user-disabled', onUserDisabled)
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
      setGroups([])
      setMessagesByPartner({})
      setMessagesByGroup({})
      setNotifications([])
      setTotalUnread(0)
      setActivePartnerId(null)
      setActiveGroupId(null)
      setLiveUserIds(new Set())
      conversationsRef.current = []
      groupsRef.current = []
    }
  }, [canUseChat, setActiveGroupId, setActivePartnerId])

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
      groups,
      messagesByPartner,
      messagesByGroup,
      activePartnerId,
      activeGroupId,
      isOnChatPage,
      notifications,
      totalUnread,
      liveUserIds,
      isChatRoute,
      setActivePartnerId,
      setActiveGroupId,
      setChatPageActive,
      isUserLive,
      getUserLastSeen,
      refreshUsers,
      refreshConversations,
      refreshGroups,
      loadMessages,
      loadGroupMessages,
      markConversationRead,
      markGroupRead,
      createGroup,
      addGroupMembers,
      removeGroupMember,
      setGroupMemberCanSend,
      updateGroupPhoto,
      sendMessage,
      sendGroupMessage,
      sendChatAttachment,
      sendGroupChatAttachment,
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
      groups,
      messagesByPartner,
      messagesByGroup,
      activePartnerId,
      activeGroupId,
      isOnChatPage,
      notifications,
      totalUnread,
      liveUserIds,
      isChatRoute,
      setActivePartnerId,
      setActiveGroupId,
      setChatPageActive,
      isUserLive,
      getUserLastSeen,
      refreshUsers,
      refreshConversations,
      refreshGroups,
      loadMessages,
      loadGroupMessages,
      markConversationRead,
      markGroupRead,
      createGroup,
      addGroupMembers,
      removeGroupMember,
      setGroupMemberCanSend,
      updateGroupPhoto,
      sendMessage,
      sendGroupMessage,
      sendChatAttachment,
      sendGroupChatAttachment,
      deleteMessageForMe,
      deleteMessageForEveryone,
      forwardMessage,
      dismissNotification,
      clearNotifications,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
