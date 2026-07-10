'use client'

import { Suspense } from 'react'
import { AppFeature } from '@myinventory/shared'
import { FeatureGate } from '@/components/auth/FeatureGate'
import { ChatPage } from '@/components/pages/ChatPage'

function ChatPageFallback() {
  return <div className="p-4 text-sm text-[var(--color-muted)]">Loading chat…</div>
}

export default function ChatRoute() {
  return (
    <FeatureGate feature={AppFeature.CHAT}>
      <Suspense fallback={<ChatPageFallback />}>
        <ChatPage />
      </Suspense>
    </FeatureGate>
  )
}
