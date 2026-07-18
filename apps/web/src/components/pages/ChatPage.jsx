'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, Paperclip, Plus, Send, Users } from 'lucide-react'
import { UserRole, getChatMessagePreview, formatChatLastSeen, getChatUserColor } from '@myinventory/shared'
import { ChatMessageActionsMenu } from '@/components/chat/ChatMessageActionsMenu'
import { CreateGroupDialog } from '@/components/chat/CreateGroupDialog'
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog'
import { ManageGroupMembersDialog } from '@/components/chat/ManageGroupMembersDialog'
import { ChatReplyBar } from '@/components/chat/ChatReplyBar'
import { MessageStatusTicks } from '@/components/chat/MessageStatusTicks'
import { ChatMessageContent } from '@/components/chat/ChatMessageContent'
import { validateChatFile } from '@/lib/chat-attachment'
import { useChat } from '@/contexts/use-chat'
import { useAuth } from '@/contexts/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { initChatAudio } from '@/lib/chat-sound'
import { cn } from '@/lib/utils'

function openMessageMenu(event, message, setMenuState) {
  event.preventDefault()
  event.stopPropagation()

  const point =
    'touches' in event && event.touches?.[0]
      ? event.touches[0]
      : 'changedTouches' in event && event.changedTouches?.[0]
        ? event.changedTouches[0]
        : event
  setMenuState({
    open: true,
    message,
    x: point.clientX,
    y: point.clientY,
  })
}

function handleMessageTap(event, message, setMenuState) {
  if (!window.matchMedia('(pointer: coarse)').matches) return
  openMessageMenu(event, message, setMenuState)
}

function formatMessageTime(value) {
  const date = new Date(value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function PresenceStatus({ isLive, lastSeenAt }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (isLive || !lastSeenAt) return undefined

    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [isLive, lastSeenAt])

  if (isLive) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[11px] font-medium',
          'text-emerald-600',
        )}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        Live
      </span>
    )
  }

  if (lastSeenAt) {
    return (
      <span className="text-[11px] font-medium text-[var(--color-muted)]">
        Last seen {formatChatLastSeen(lastSeenAt, now)}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium',
        'text-red-500',
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
      Offline
    </span>
  )
}

function UserAvatar({ name, userId, photoUrl, isLive, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
  return (
    <div className="relative shrink-0">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`${name}'s profile`}
          className={cn(sizeClass, 'rounded-full object-cover')}
        />
      ) : (
        <div
          className={cn('flex items-center justify-center rounded-full font-semibold text-white', sizeClass)}
          style={{ backgroundColor: getChatUserColor(userId) }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {typeof isLive === 'boolean' && (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white',
            isLive ? 'bg-emerald-500' : 'bg-red-500',
          )}
          aria-hidden
        />
      )}
    </div>
  )
}

function GroupAvatar({ name }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function UserListItem({ user, isActive, isLive, lastSeenAt, unreadCount, subtitle, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(user.id)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
        isActive
          ? 'border-[var(--color-primary)] bg-[var(--color-sidebar-active)]'
          : 'border-transparent hover:bg-gray-50',
      )}
    >
      <UserAvatar name={user.name} userId={user.id} photoUrl={user.profilePhotoUrl} isLive={isLive} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary-foreground)]">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-[var(--color-muted)]">{subtitle}</p>
          <PresenceStatus isLive={isLive} lastSeenAt={lastSeenAt} />
        </div>
      </div>
    </button>
  )
}

function GroupListItem({ group, isActive, onSelect }) {
  const subtitle = group.lastMessage
    ? getChatMessagePreview(group.lastMessage)
    : `${group.members?.length ?? 0} members`

  return (
    <button
      type="button"
      onClick={() => onSelect(group.id)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
        isActive
          ? 'border-[var(--color-primary)] bg-[var(--color-sidebar-active)]'
          : 'border-transparent hover:bg-gray-50',
      )}
    >
      <GroupAvatar name={group.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{group.name}</p>
          {group.unreadCount > 0 && (
            <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary-foreground)]">
              {group.unreadCount}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">{subtitle}</p>
      </div>
    </button>
  )
}

export function ChatPage() {
  const { user, hasRole } = useAuth()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true)
  const [replyToMessage, setReplyToMessage] = useState(null)
  const [menuState, setMenuState] = useState({ open: false, message: null, x: 0, y: 0 })
  const [forwardMessage, setForwardMessage] = useState(null)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [manageMembersOpen, setManageMembersOpen] = useState(false)

  const {
    canUseChat,
    isConnected,
    chatUsers,
    conversations,
    groups: groupsValue,
    messagesByPartner,
    messagesByGroup,
    activePartnerId,
    activeGroupId,
    setActivePartnerId,
    setActiveGroupId,
    setChatPageActive,
    refreshUsers,
    refreshConversations,
    refreshGroups,
    loadMessages,
    loadGroupMessages,
    markConversationRead,
    markGroupRead,
    sendMessage,
    sendGroupMessage,
    sendChatAttachment,
    sendGroupAttachment,
    createGroup,
    addGroupMembers,
    removeGroupMember,
    updateGroupMemberMute,
    deleteMessageForMe,
    deleteMessageForEveryone,
    forwardMessage: forwardMessageToUser,
    dismissNotification,
    isUserLive,
    getUserLastSeen,
  } = useChat()

  const safeChatUsers = Array.isArray(chatUsers) ? chatUsers : []
  const safeConversations = Array.isArray(conversations) ? conversations : []
  const canManageGroups = hasRole(UserRole.ADMIN, UserRole.MANAGER)
  const requestedUserId = searchParams.get('user')
  const requestedGroupId = searchParams.get('group')

  const usersWithMeta = useMemo(() => {
    const conversationByPartner = new Map(
      safeConversations.map((conversation) => [conversation.partnerId, conversation]),
    )

    const merged = new Map()

    for (const chatUser of safeChatUsers) {
      const conversation = conversationByPartner.get(chatUser.id)
      merged.set(chatUser.id, {
        ...chatUser,
        unreadCount: conversation?.unreadCount ?? 0,
        subtitle: conversation?.lastMessage
          ? getChatMessagePreview(conversation.lastMessage)
          : chatUser.email,
        lastMessageAt: conversation?.lastMessage?.createdAt ?? null,
      })
    }

    for (const conversation of safeConversations) {
      if (merged.has(conversation.partnerId)) continue
      merged.set(conversation.partnerId, {
        id: conversation.partnerId,
        name: conversation.partnerName,
        email: conversation.partnerEmail,
        profilePhotoUrl: conversation.partnerProfilePhotoUrl,
        role: conversation.partnerRole,
        unreadCount: conversation.unreadCount,
        subtitle: conversation.lastMessage
          ? getChatMessagePreview(conversation.lastMessage)
          : conversation.partnerEmail,
        lastMessageAt: conversation.lastMessage?.createdAt ?? null,
      })
    }

    return Array.from(merged.values()).sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      if (aTime !== bTime) return bTime - aTime
      return a.name.localeCompare(b.name)
    })
  }, [safeChatUsers, safeConversations])

  // Avoid useMemo here — Turbopack/React Compiler wrapping previously
  // surfaced a misleading "groups is not iterable" crash on this sort.
  const sortedGroups = (() => {
    const list = Array.isArray(groupsValue) ? groupsValue.slice() : []
    list.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0
      if (aTime !== bTime) return bTime - aTime
      return String(a.name ?? '').localeCompare(String(b.name ?? ''))
    })
    return list
  })()

  const activeUser = usersWithMeta.find((item) => item.id === activePartnerId) ?? null
  const activeGroup = (Array.isArray(groupsValue) ? groupsValue : []).find(
    (item) => item.id === activeGroupId,
  ) ?? null
  const isGroupChat = Boolean(activeGroupId)
  const activeMessages = isGroupChat
    ? messagesByGroup[activeGroupId] ?? []
    : activePartnerId
      ? messagesByPartner[activePartnerId] ?? []
      : []

  const isMuted =
    isGroupChat && activeGroup?.currentMember != null && activeGroup.currentMember.canSend === false
  const canCompose =
    !isGroupChat
      ? Boolean(activePartnerId)
      : Boolean(activeGroup?.currentMember?.canSend) && uploadProgress === null

  const selectPartner = useCallback(
    async (partnerId) => {
      setActivePartnerId(partnerId)
      setShowSidebarOnMobile(false)
      setSendError(null)
      setReplyToMessage(null)
      dismissNotification(partnerId)
      await loadMessages(partnerId)
      await markConversationRead(partnerId)
    },
    [dismissNotification, loadMessages, markConversationRead, setActivePartnerId],
  )

  const selectGroup = useCallback(
    async (groupId) => {
      setActiveGroupId(groupId)
      setShowSidebarOnMobile(false)
      setSendError(null)
      setReplyToMessage(null)
      dismissNotification({ groupId })
      await loadGroupMessages(groupId)
      await markGroupRead(groupId)
    },
    [dismissNotification, loadGroupMessages, markGroupRead, setActiveGroupId],
  )

  useEffect(() => {
    setChatPageActive(true)
    initChatAudio()
    void refreshUsers()
    void refreshConversations()
    void refreshGroups()

    return () => {
      setChatPageActive(false)
      setActivePartnerId(null)
      setActiveGroupId(null)
    }
    // Mount/unmount only — socket presence must not thrash on data refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (requestedGroupId) {
      void selectGroup(requestedGroupId)
      return
    }
    if (requestedUserId) {
      void selectPartner(requestedUserId)
    }
  }, [requestedGroupId, requestedUserId, selectGroup, selectPartner])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, activePartnerId, activeGroupId])

  function handleSend(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !canCompose || isMuted) return

    const replyToMessageId = replyToMessage?.id
    setDraft('')
    setReplyToMessage(null)
    setSendError(null)

    const sendPromise = isGroupChat
      ? sendGroupMessage(activeGroupId, text, { replyToMessageId })
      : sendMessage(activePartnerId, text, { replyToMessageId })

    void sendPromise.catch((error) => {
      setSendError(error instanceof Error ? error.message : 'Could not send message')
    })
  }

  function handleAttachClick() {
    if (!canCompose || isMuted) return
    fileInputRef.current?.click()
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || (!activePartnerId && !activeGroupId) || isMuted) return

    const validationError = validateChatFile(file)
    if (validationError) {
      setSendError(validationError)
      return
    }

    setSendError(null)
    setUploadProgress(0)

    const uploadPromise = isGroupChat
      ? sendGroupAttachment(activeGroupId, file, {
          body: draft.trim(),
          onProgress: (loaded, total) => {
            if (total > 0) {
              setUploadProgress(Math.round((loaded / total) * 100))
            }
          },
        })
      : sendChatAttachment(activePartnerId, file, {
          body: draft.trim(),
          onProgress: (loaded, total) => {
            if (total > 0) {
              setUploadProgress(Math.round((loaded / total) * 100))
            }
          },
        })

    void uploadPromise
      .then(() => {
        setDraft('')
        setUploadProgress(null)
      })
      .catch((error) => {
        setUploadProgress(null)
        setSendError(error instanceof Error ? error.message : 'Could not upload file')
      })
  }

  async function handleForwardSelect(targetPartnerId) {
    if (!forwardMessage) return

    setSendError(null)
    try {
      await forwardMessageToUser(targetPartnerId, forwardMessage.id)
      setForwardMessage(null)
      if (targetPartnerId !== activePartnerId) {
        await selectPartner(targetPartnerId)
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not forward message')
    }
  }

  async function handleCreateGroup(name, memberIds) {
    const group = await createGroup(name, memberIds)
    if (group?.id) {
      await selectGroup(group.id)
    }
  }

  const hasActiveThread = Boolean(activePartnerId || activeGroupId)

  if (!canUseChat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>You do not have permission to use chat.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[32rem] flex-col gap-4 lg:h-[calc(100dvh-5rem)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Chat</h1>
          <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            Message teammates in your organization
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium',
                isConnected ? 'text-emerald-600' : 'text-amber-600',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  isConnected ? 'bg-emerald-500' : 'animate-pulse bg-amber-500',
                )}
                aria-hidden
              />
              {isConnected ? 'Connected' : 'Reconnecting…'}
            </span>
          </p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] sm:flex">
          <MessageCircle className="h-3.5 w-3.5" />
          {sortedGroups.length} groups · {usersWithMeta.length} users
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card
          className={cn(
            'min-h-0 overflow-hidden',
            !showSidebarOnMobile && hasActiveThread
              ? 'hidden lg:flex lg:flex-col'
              : 'flex flex-col',
          )}
        >
          <CardHeader className="border-b border-[var(--color-border)] py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Conversations
                </CardTitle>
                <CardDescription>Groups and direct messages</CardDescription>
              </div>
              {canManageGroups && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateGroupOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Group
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 overflow-y-auto p-3">
            <div className="space-y-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Groups
              </p>
              {sortedGroups.length === 0 ? (
                <p className="px-2 py-3 text-center text-sm text-[var(--color-muted)]">
                  {canManageGroups
                    ? 'No groups yet. Create one to get started.'
                    : 'No group chats yet.'}
                </p>
              ) : (
                sortedGroups.map((group) => (
                  <GroupListItem
                    key={group.id}
                    group={group}
                    isActive={group.id === activeGroupId}
                    onSelect={selectGroup}
                  />
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                People
              </p>
              {usersWithMeta.length === 0 ? (
                <p className="px-2 py-3 text-center text-sm text-[var(--color-muted)]">
                  No other active users in your organization yet.
                </p>
              ) : (
                usersWithMeta.map((chatUser) => (
                  <UserListItem
                    key={chatUser.id}
                    user={chatUser}
                    isActive={chatUser.id === activePartnerId}
                    isLive={isUserLive(chatUser.id)}
                    lastSeenAt={getUserLastSeen(chatUser.id) ?? chatUser.lastSeenAt ?? null}
                    unreadCount={chatUser.unreadCount}
                    subtitle={chatUser.subtitle}
                    onSelect={selectPartner}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!hasActiveThread ? (
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-sidebar-active)] text-[var(--color-primary)]">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">Select a conversation</p>
                <p className="text-sm text-[var(--color-muted)]">
                  Choose a group or person from the list to start chatting.
                </p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-[var(--color-border)] py-4">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="lg:hidden"
                    onClick={() => setShowSidebarOnMobile(true)}
                  >
                    Back
                  </Button>
                  {isGroupChat ? (
                    <>
                      <GroupAvatar name={activeGroup?.name ?? 'G'} />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base">
                          {activeGroup?.name ?? 'Group'}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {activeGroup?.members?.length ?? 0} members
                        </CardDescription>
                      </div>
                      {canManageGroups && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setManageMembersOpen(true)}
                        >
                          Manage
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <UserAvatar
                        name={activeUser?.name ?? 'User'}
                        userId={activeUser?.id}
                        photoUrl={activeUser?.profilePhotoUrl}
                        isLive={isUserLive(activePartnerId)}
                      />
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{activeUser?.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <CardDescription className="truncate">{activeUser?.email}</CardDescription>
                          <PresenceStatus
                            isLive={isUserLive(activePartnerId)}
                            lastSeenAt={
                              getUserLastSeen(activePartnerId) ?? activeUser?.lastSeenAt ?? null
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {isGroupChat && !activeGroup?.currentMember ? (
                    <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                      You are not a member of this group.
                      {canManageGroups
                        ? ' Use Manage to add yourself or others.'
                        : ''}
                    </p>
                  ) : activeMessages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                      No messages yet. Say hello.
                    </p>
                  ) : (
                    activeMessages.map((message) => {
                      const isMine = message.senderId === user?.id
                      const isDm = !isGroupChat
                      const canShowMenu =
                        !message.id.startsWith('temp-') &&
                        (isDm || (!isMuted && !message.isDeletedForEveryone))
                      return (
                        <div
                          key={message.id}
                          className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}
                        >
                          {!isMine && (
                            <UserAvatar
                              name={message.senderName ?? activeUser?.name ?? 'User'}
                              userId={message.senderId}
                              photoUrl={message.senderProfilePhotoUrl ?? activeUser?.profilePhotoUrl}
                              size="sm"
                            />
                          )}
                          <div
                            role={canShowMenu ? 'button' : undefined}
                            tabIndex={canShowMenu ? 0 : undefined}
                            onContextMenu={
                              canShowMenu
                                ? (event) => openMessageMenu(event, message, setMenuState)
                                : undefined
                            }
                            onClick={
                              canShowMenu
                                ? (event) => handleMessageTap(event, message, setMenuState)
                                : undefined
                            }
                            onKeyDown={
                              canShowMenu
                                ? (event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      openMessageMenu(event, message, setMenuState)
                                    }
                                  }
                                : undefined
                            }
                            className={cn(
                              'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                              canShowMenu && 'cursor-pointer select-none',
                              isMine
                                ? 'rounded-br-md bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                                : 'rounded-bl-md border border-[var(--color-border)] bg-white text-gray-900',
                            )}
                          >
                            {isGroupChat && !isMine && (
                              <p
                                className="mb-1 text-[11px] font-semibold"
                                style={{ color: getChatUserColor(message.senderId) }}
                              >
                                {message.senderName ?? 'User'}
                              </p>
                            )}
                            <ChatMessageContent message={message} isMine={isMine} />
                            <div
                              className={cn(
                                'mt-1 flex items-center justify-end gap-1 text-[10px]',
                                isMine ? 'text-white/80' : 'text-[var(--color-muted)]',
                              )}
                            >
                              <span>{formatMessageTime(message.createdAt)}</span>
                              {isDm && <MessageStatusTicks message={message} isMine={isMine} />}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={handleSend}
                  className="border-t border-[var(--color-border)] p-4"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
                    onChange={handleFileChange}
                  />
                  {sendError && (
                    <p className="mb-2 text-sm text-red-600">{sendError}</p>
                  )}
                  {isMuted && (
                    <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      You are muted in this group and cannot send messages.
                    </p>
                  )}
                  {isGroupChat && !activeGroup?.currentMember && (
                    <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Join this group (via Manage) before you can send messages.
                    </p>
                  )}
                  {uploadProgress !== null && (
                    <div className="mb-3">
                      <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
                        <span>Uploading…</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <ChatReplyBar message={replyToMessage} onCancel={() => setReplyToMessage(null)} />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAttachClick}
                      disabled={!canCompose || isMuted || uploadProgress !== null}
                      aria-label="Attach image, video, or file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={
                        isMuted
                          ? 'You are muted…'
                          : isGroupChat
                            ? `Message ${activeGroup?.name ?? 'group'}…`
                            : `Message ${activeUser?.name ?? 'user'}…`
                      }
                      maxLength={4000}
                      disabled={!canCompose || isMuted || uploadProgress !== null}
                    />
                    <Button
                      type="submit"
                      disabled={
                        !draft.trim() || !canCompose || isMuted || uploadProgress !== null
                      }
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <ChatMessageActionsMenu
        open={menuState.open}
        x={menuState.x}
        y={menuState.y}
        isMine={menuState.message?.senderId === user?.id}
        canDeleteForMe={!isGroupChat}
        canDeleteForEveryone={
          !isGroupChat &&
          menuState.message?.senderId === user?.id &&
          !menuState.message?.isDeletedForEveryone
        }
        canReply={!menuState.message?.isDeletedForEveryone && !isMuted}
        canForward={!isGroupChat && !menuState.message?.isDeletedForEveryone}
        onReply={() => {
          if (menuState.message && !menuState.message.isDeletedForEveryone) {
            setReplyToMessage(menuState.message)
          }
        }}
        onForward={() => {
          if (!isGroupChat && menuState.message && !menuState.message.isDeletedForEveryone) {
            setForwardMessage(menuState.message)
          }
        }}
        onDeleteForMe={() => {
          if (menuState.message && activePartnerId && !isGroupChat) {
            void deleteMessageForMe(activePartnerId, menuState.message.id).catch((error) => {
              setSendError(error instanceof Error ? error.message : 'Could not delete message')
            })
          }
        }}
        onDeleteForEveryone={() => {
          if (menuState.message && activePartnerId && !isGroupChat) {
            void deleteMessageForEveryone(activePartnerId, menuState.message.id).catch((error) => {
              setSendError(error instanceof Error ? error.message : 'Could not delete message')
            })
          }
        }}
        onClose={() => setMenuState({ open: false, message: null, x: 0, y: 0 })}
      />

      <ForwardMessageDialog
        open={Boolean(forwardMessage)}
        users={usersWithMeta}
        currentPartnerId={activePartnerId}
        onSelect={handleForwardSelect}
        onClose={() => setForwardMessage(null)}
      />

      <CreateGroupDialog
        open={createGroupOpen}
        users={chatUsers}
        onClose={() => setCreateGroupOpen(false)}
        onCreate={handleCreateGroup}
      />

      <ManageGroupMembersDialog
        open={manageMembersOpen}
        group={activeGroup}
        availableUsers={chatUsers}
        onClose={() => setManageMembersOpen(false)}
        onAddMembers={async (userIds) => {
          if (!activeGroupId) return
          await addGroupMembers(activeGroupId, userIds)
        }}
        onRemoveMember={async (userId) => {
          if (!activeGroupId) return
          await removeGroupMember(activeGroupId, userId)
        }}
        onToggleMute={async (userId, canSend) => {
          if (!activeGroupId) return
          await updateGroupMemberMute(activeGroupId, userId, canSend)
        }}
      />
    </div>
  )
}
