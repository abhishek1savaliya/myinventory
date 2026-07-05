import * as React from 'react'
import { cn } from '@renderer/lib/utils'

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn('text-sm font-medium leading-none text-gray-700', className)}
      {...props}
    />
  )
}
