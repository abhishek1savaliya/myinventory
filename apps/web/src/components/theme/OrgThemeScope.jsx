'use client'

import { cn } from '@/lib/utils'
import { buildOrgThemeStyle } from '@/lib/org-theme'

export function OrgThemeScope({ themeColor, className, style, children, ...props }) {
  const themeStyle = buildOrgThemeStyle(themeColor)

  return (
    <div className={cn('org-theme', className)} style={{ ...themeStyle, ...style }} {...props}>
      {children}
    </div>
  )
}
