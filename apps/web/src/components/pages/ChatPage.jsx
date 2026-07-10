'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, Paperclip, Send, Users } from 'lucide-react'
import { getChatMessagePreview } from '@myinventory/shared'
import { ChatMessageActionsMenu } from '@/components/chat/ChatMessageActionsMenu'
import { ForwardMessageDialog } from '@/components/chat/ForwardMessageDialog'
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

function PresenceStatus({ isLive }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium',
        isLive ? 'text-emerald-600' : 'text-red-500',
      )}
    >
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', isLive ? 'bg-emerald-500' : 'bg-red-500')}
        aria-hidden
      />
      {isLive ? 'Live' : 'Offline'}
    </span>
  )
}

function UserAvatar({ name, isLive }) {
  return (
    <div className="relative shrink-0">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-primary-foreground)]">
        {name.charAt(0).toUpperCase()}
      </div>
      <span
        className={cn(
          'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white',
          isLive ? 'bg-emerald-500' : 'bg-red-500',
        )}
        aria-hidden
      />
    </div>
  )
}

function UserListItem({ user, isActive, isLive, unreadCount, subtitle, onSelect }) {
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
      <UserAvatar name={user.name} isLive={isLive} />
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
          <PresenceStatus isLive={isLive} />
        </div>
      </div>
    </button>
  )
}

export function ChatPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [showUsersOnMobile, setShowUsersOnMobile] = useState(true)
  const [replyToMessage, setReplyToMessage] = useState(null)
  const [menuState, setMenuState] = useState({ open: false, message: null, x: 0, y: 0 })
  const [forwardMessage, setForwardMessage] = useState(null)

  const {
    canUseChat,
    isConnected,
    chatUsers,
    conversations,
    messagesByPartner,
    activePartnerId,
    setActivePartnerId,
    setChatPageActive,
    refreshUsers,
    refreshConversations,
    loadMessages,
    markConversationRead,
    sendMessage,
    sendChatAttachment,
    deleteMessageForMe,
    deleteMessageForEveryone,
    forwardMessage: forwardMessageToUser,
    dismissNotification,
    isUserLive,
  } = useChat()

  const requestedUserId = searchParams.get('user')

  const usersWithMeta = useMemo(() => {
    const conversationByPartner = new Map(
      conversations.map((conversation) => [conversation.partnerId, conversation]),
    )

    const merged = new Map()

    for (const chatUser of chatUsers) {
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

    for (const conversation of conversations) {
      if (merged.has(conversation.partnerId)) continue
      merged.set(conversation.partnerId, {
        id: conversation.partnerId,
        name: conversation.partnerName,
        email: conversation.partnerEmail,
        role: conversation.partnerRole,
        unreadCount: conversation.unreadCount,
        subtitle: conversation.lastMessage
          ? getChatMessagePreview(conversation.lastMessage)
          : conversation.partnerEmail,
        lastMessageAt: conversation.lastMessage?.createdAt ?? null,
      })
    }

    return [...merged.values()].sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      if (aTime !== bTime) return bTime - aTime
      return a.name.localeCompare(b.name)
    })
  }, [chatUsers, conversations])

  const activeUser = usersWithMeta.find((item) => item.id === activePartnerId) ?? null
  const activeMessages = activePartnerId ? messagesByPartner[activePartnerId] ?? [] : []

  const selectPartner = useCallback(
    async (partnerId) => {
      setActivePartnerId(partnerId)
      setShowUsersOnMobile(false)
      setSendError(null)
      dismissNotification(partnerId)
      await loadMessages(partnerId)
      await markConversationRead(partnerId)
    },
    [dismissNotification, loadMessages, markConversationRead, setActivePartnerId],
  )

  useEffect(() => {
    setChatPageActive(true)
    initChatAudio()
    void refreshUsers()
    void refreshConversations()

    return () => {
      setChatPageActive(false)
      setActivePartnerId(null)
    }
    // Mount/unmount only — socket presence must not thrash on data refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!requestedUserId) return
    void selectPartner(requestedUserId)
  }, [requestedUserId, selectPartner])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, activePartnerId])

  function handleSend(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!activePartnerId || !text) return

    const replyToMessageId = replyToMessage?.id
    setDraft('')
    setReplyToMessage(null)
    setSendError(null)

    void sendMessage(activePartnerId, text, { replyToMessageId }).catch((error) => {
      setSendError(error instanceof Error ? error.message : 'Could not send message')
    })
  }

  function handleAttachClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !activePartnerId) return

    const validationError = validateChatFile(file)
    if (validationError) {
      setSendError(validationError)
      return
    }

    setSendError(null)
    setUploadProgress(0)

    void sendChatAttachment(activePartnerId, file, {
      body: draft.trim(),
      onProgress: (loaded, total) => {
        if (total > 0) {
          setUploadProgress(Math.round((loaded / total) * 100))
        }
      },
    })
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
          {usersWithMeta.length} users
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card
          className={cn(
            'min-h-0 overflow-hidden',
            !showUsersOnMobile && activePartnerId ? 'hidden lg:flex lg:flex-col' : 'flex flex-col',
          )}
        >
          <CardHeader className="border-b border-[var(--color-border)] py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              People
            </CardTitle>
            <CardDescription>Select someone to start chatting</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 overflow-y-auto p-3">
            {usersWithMeta.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-[var(--color-muted)]">
                No other active users in your organization yet.
              </p>
            ) : (
              usersWithMeta.map((chatUser) => (
                <UserListItem
                  key={chatUser.id}
                  user={chatUser}
                  isActive={chatUser.id === activePartnerId}
                  isLive={isUserLive(chatUser.id)}
                  unreadCount={chatUser.unreadCount}
                  subtitle={chatUser.subtitle}
                  onSelect={selectPartner}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {!activePartnerId ? (
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-sidebar-active)] text-[var(--color-primary)]">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">Select a user</p>
                <p className="text-sm text-[var(--color-muted)]">
                  Choose someone from the list to view your conversation.
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
                    onClick={() => setShowUsersOnMobile(true)}
                  >
                    Back
                  </Button>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{activeUser?.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <CardDescription className="truncate">{activeUser?.email}</CardDescription>
                      <PresenceStatus isLive={isUserLive(activePartnerId)} />
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {activeMessages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-[var(--color-muted)]">
                      No messages yet. Say hello.
                    </p>
                  ) : (
                    activeMessages.map((message) => {
                      const isMine = message.senderId === user?.id
                      const canShowMenu = !message.id.startsWith('temp-')
                      return (
                        <div
                          key={message.id}
                          className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                        >
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
                            <ChatMessageContent message={message} isMine={isMine} />
                            <div
                              className={cn(
                                'mt-1 flex items-center justify-end gap-1 text-[10px]',
                                isMine ? 'text-white/80' : 'text-[var(--color-muted)]',
                              )}
                            >
                              <span>{formatMessageTime(message.createdAt)}</span>
                              <MessageStatusTicks message={message} isMine={isMine} />
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
                      disabled={!activePartnerId || uploadProgress !== null}
                      aria-label="Attach image, video, or file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={`Message ${activeUser?.name ?? 'user'}…`}
                      maxLength={4000}
                      disabled={uploadProgress !== null}
                    />
                    <Button type="submit" disabled={!draft.trim() || uploadProgress !== null}>
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
        canDeleteForEveryone={
          menuState.message?.senderId === user?.id && !menuState.message?.isDeletedForEveryone
        }
        canReply={!menuState.message?.isDeletedForEveryone}
        canForward={!menuState.message?.isDeletedForEveryone}
        onReply={() => {
          if (menuState.message && !menuState.message.isDeletedForEveryone) {
            setReplyToMessage(menuState.message)
          }
        }}
        onForward={() => {
          if (menuState.message && !menuState.message.isDeletedForEveryone) {
            setForwardMessage(menuState.message)
          }
        }}
        onDeleteForMe={() => {
          if (menuState.message && activePartnerId) {
            void deleteMessageForMe(activePartnerId, menuState.message.id).catch((error) => {
              setSendError(error instanceof Error ? error.message : 'Could not delete message')
            })
          }
        }}
        onDeleteForEveryone={() => {
          if (menuState.message && activePartnerId) {
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
    </div>
  )
}
