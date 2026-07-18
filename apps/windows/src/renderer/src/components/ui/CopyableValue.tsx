// @ts-nocheck
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

export function CopyableValue({ label, value, description, mono = false }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable on some browsers
    }
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            {label}
          </p>
          <p className={`mt-1 break-all text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
            {value || '—'}
          </p>
          {description && <p className="mt-1 text-xs text-[var(--color-muted)]">{description}</p>}
        </div>
        {value && (
          <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>
    </div>
  )
}
