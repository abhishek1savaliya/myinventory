'use client'

import { UserRole } from '@myinventory/shared'
import { RoleGate } from '@/components/auth/RoleGate'
import { UsersPage } from '@/components/pages/UsersPage'

export default function UsersRoute() {
  return (
    <RoleGate roles={[UserRole.ADMIN]}>
      <UsersPage />
    </RoleGate>
  )
}
