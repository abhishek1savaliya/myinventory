import { useEffect, useState } from 'react'
import type { AuthUser, ResetUserPasswordResponse } from '@myinventory/shared'
import { Check, Copy } from 'lucide-react'
import { apiFetch, ApiRequestError } from '@renderer/lib/api-client'
import { Button } from '@renderer/components/ui/button'
import { Dialog } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'

interface Props {
  user: AuthUser | null
  open: boolean
  onClose: () => void
}

export function ResetUserPasswordDialog({ user, open, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setResult('')
    setError('')
    setCopied(false)
  }, [open, user?.id])

  if (!user) return null
  const selectedUser = user

  async function handleReset() {
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await apiFetch<{ data: ResetUserPasswordResponse }>(
        `/api/users/${selectedUser.id}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify(password ? { password } : {}),
        },
      )
      setResult(response.data.temporaryPassword)
      setPassword('')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Reset password for ${selectedUser.name}`}
      description="Existing passwords are securely hashed and cannot be viewed. Reset it to create a new password."
    >
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">New password — shown only now</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-white px-3 py-2 text-sm text-gray-900">
                {result}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            Send this password securely to the user. It cannot be retrieved again after closing.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-user-password">New password (optional)</Label>
            <Input
              id="reset-user-password"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Leave blank to generate a secure password"
            />
            <p className="text-xs text-[var(--color-muted)]">
              Enter at least 8 characters, or leave blank to generate one automatically.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleReset} disabled={saving}>
              {saving ? 'Resetting…' : password ? 'Set new password' : 'Generate and reset'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
