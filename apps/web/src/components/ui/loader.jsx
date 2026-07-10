import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
}

export function Loader({ size = 'md', label, className, centered = false }) {
  const spinner = (
    <Loader2
      className={cn('animate-spin text-[var(--color-primary)]', sizeClasses[size])}
      aria-hidden="true"
    />
  )

  if (centered) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center gap-3', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {spinner}
        {label ? <p className="text-sm text-[var(--color-muted)]">{label}</p> : null}
      </div>
    )
  }

  return (
    <div
      className={cn('inline-flex items-center gap-2', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {spinner}
      {label ? <span className="text-sm text-[var(--color-muted)]">{label}</span> : null}
    </div>
  )
}

export function PageLoader({ className }) {
  return <Loader centered size="md" className={cn('py-12', className)} />
}

export function FullPageLoader({ className }) {
  return <Loader centered size="lg" className={cn('h-full min-h-[12rem]', className)} />
}
