import { useCallback, useEffect, useState } from 'react'
import type { UserDisableRequestDto } from '@myinventory/shared'
import { UserRole } from '@myinventory/shared'
import { apiFetch } from '@renderer/lib/api-client'
import { useAuth } from '@renderer/contexts/use-auth'
import { Button } from '@renderer/components/ui/button'

export function DisableRequestBanner() {
  const { user, logout, hasRole } = useAuth()
  const [requests, setRequests] = useState<UserDisableRequestDto[]>([])

  const loadRequests = useCallback(async () => {
    if (!user || !hasRole(UserRole.ADMIN)) {
      setRequests([])
      return
    }

    try {
      const response = await apiFetch<{ data: UserDisableRequestDto[] }>(
        '/api/users/disable-requests/incoming',
      )
      setRequests(response.data)
    } catch {
      setRequests([])
    }
  }, [user, hasRole])

  useEffect(() => {
    void loadRequests()
    const interval = setInterval(() => void loadRequests(), 30000)
    return () => clearInterval(interval)
  }, [loadRequests])

  if (requests.length === 0) return null

  async function handleAccept(requestId: string) {
    const response = await apiFetch<{ data: { message: string } }>(
      `/api/users/disable-requests/${requestId}/accept`,
      { method: 'POST' },
    )
    alert(response.data.message)
    logout()
  }

  async function handleReject(requestId: string) {
    await apiFetch(`/api/users/disable-requests/${requestId}/reject`, { method: 'POST' })
    await loadRequests()
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900"
        >
          <p>
            <strong>{request.requestedByName}</strong> ({request.requestedByEmail}) has requested
            to disable your admin account. Accepting will sign you out immediately.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void handleReject(request.id)}>
              Reject
            </Button>
            <Button size="sm" onClick={() => void handleAccept(request.id)}>
              Accept & sign out
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
