import { Check } from 'lucide-react'
import { getChatDeliveryStatus } from '@myinventory/shared'
import { cn } from '@renderer/lib/utils'

export function MessageStatusTicks({ message, isMine }) {
  if (!isMine) return null

  const status = getChatDeliveryStatus(message)

  if (status === 'sending') {
    return (
      <span className="inline-flex h-3 w-3 items-center justify-center opacity-70" aria-label="Sending">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      </span>
    )
  }

  if (status === 'failed') {
    return (
      <span className="text-[10px] font-semibold text-red-200" aria-label="Failed to send">
        !
      </span>
    )
  }

  if (status === 'sent') {
    return <Check className="h-3.5 w-3.5 opacity-90" aria-label="Sent" />
  }

  const tickColor = status === 'read' ? 'text-sky-300' : 'opacity-90'

  return (
    <span className={cn('relative inline-flex h-3.5 w-5', tickColor)} aria-label={status === 'read' ? 'Read' : 'Delivered'}>
      <Check className="absolute left-0 top-0 h-3.5 w-3.5" strokeWidth={2.5} />
      <Check className="absolute left-1.5 top-0 h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  )
}
