import { cn } from '@/lib/utils'

const variants = {
  active: 'bg-green-50 text-green-700',
  disabled: 'bg-gray-100 text-gray-600',
  inactive: 'bg-gray-100 text-gray-600',
  default: 'bg-gray-100 text-gray-700',
}

export function StatusBadge({ status, className }) {
  const key =
    status === 'ACTIVE'
      ? 'active'
      : status === 'DISABLED'
        ? 'disabled'
        : status === 'INACTIVE'
          ? 'inactive'
          : 'default'

  return (
    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', variants[key], className)}>
      {status}
    </span>
  )
}
