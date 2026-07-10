'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageCircle, Send, Users } from 'lucide-react'
import { useChat } from '@/contexts/use-chat'
import { useAuth } from '@/contexts/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function formatMessageTime(value) {
  const date = new Date(value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function UserListItem({ user, isActive, unreadCount, subtitle, onSelect }) {
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-primary-foreground)]">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary-foreground)]">
              {unreadCount}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-[var(--color-muted)]">{subtitle}</p>
      </div>
    </button>
  )
}

export function ChatPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const messagesEndRef = useRef(null)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [showUsersOnMobile, setShowUsersOnMobile] = useState(true)

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
    dismissNotification,
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
        subtitle: conversation?.lastMessage?.body ?? chatUser.email,
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
        subtitle: conversation.lastMessage?.body ?? conversation.partnerEmail,
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
    void refreshUsers()
    void refreshConversations()

    return () => {
      setChatPageActive(false)
      setActivePartnerId(null)
    }
  }, [refreshConversations, refreshUsers, setActivePartnerId, setChatPageActive])

  useEffect(() => {
    if (!requestedUserId) return
    void selectPartner(requestedUserId)
  }, [requestedUserId, selectPartner])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length, activePartnerId])

  async function handleSend(event) {
    event.preventDefault()
    if (!activePartnerId || !draft.trim() || isSending) return

    setIsSending(true)
    setSendError(null)

    try {
      await sendMessage(activePartnerId, draft)
      setDraft('')
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not send message')
    } finally {
      setIsSending(false)
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
          <p className="text-sm text-[var(--color-muted)]">
            Message teammates in your organization
            {isConnected ? ' · Live' : ' · Reconnecting…'}
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
                    <CardDescription className="truncate">{activeUser?.email}</CardDescription>
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
                      return (
                        <div
                          key={message.id}
                          className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                        >
                          <div
                            className={cn(
                              'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                              isMine
                                ? 'rounded-br-md bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                                : 'rounded-bl-md border border-[var(--color-border)] bg-white text-gray-900',
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                            <p
                              className={cn(
                                'mt-1 text-[10px]',
                                isMine ? 'text-white/80' : 'text-[var(--color-muted)]',
                              )}
                            >
                              {formatMessageTime(message.createdAt)}
                            </p>
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
                  {sendError && (
                    <p className="mb-2 text-sm text-red-600">{sendError}</p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={`Message ${activeUser?.name ?? 'user'}…`}
                      maxLength={4000}
                      disabled={isSending}
                    />
                    <Button type="submit" disabled={isSending || !draft.trim()}>
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
    </div>
  )
}
