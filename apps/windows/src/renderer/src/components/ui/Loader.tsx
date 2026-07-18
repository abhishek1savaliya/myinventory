import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
}

export function PageLoader({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" aria-hidden />
    </div>
  )
}
