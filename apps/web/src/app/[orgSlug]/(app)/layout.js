'use client'

import { ProtectedLayout } from '@/components/auth/ProtectedLayout'

export default function AppLayout({ children }) {
  return <ProtectedLayout>{children}</ProtectedLayout>
}
