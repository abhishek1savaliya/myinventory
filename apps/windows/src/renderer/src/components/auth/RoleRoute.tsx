import { Navigate } from 'react-router-dom'
import { UserRole } from '@myinventory/shared'
import { useAuth } from '@renderer/contexts/use-auth'

interface RoleRouteProps {
  roles: UserRole[]
  children: React.ReactNode
}

export function RoleRoute({ roles, children }: RoleRouteProps) {
  const { hasRole, isLoading } = useAuth()

  if (isLoading) {
    return null
  }

  if (!hasRole(...roles)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
