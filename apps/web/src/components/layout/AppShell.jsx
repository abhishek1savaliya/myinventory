'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/use-auth'
import { DisableRequestBanner } from '@/components/users/DisableRequestBanner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { navItems } from '@/lib/nav-items'

export function AppShell({ children }) {
  const pathname = usePathname()
  const { user, logout, hasFeature } = useAuth()

  const visibleNavItems = navItems.filter((item) => hasFeature(item.feature))

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)]">
        <div className="border-b border-[var(--color-sidebar-border)] px-4 py-4">
          <h1 className="text-lg font-semibold text-[var(--color-primary)]">MyInventory</h1>
          <p className="text-xs text-[var(--color-muted)]">Warehouse Management</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {visibleNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors',
                  isActive
                    ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
                    : 'hover:bg-gray-100',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-[var(--color-sidebar-border)] p-3">
          <div className="mb-2 px-1">
            <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="truncate text-xs text-[var(--color-muted)]">{user?.email}</p>
            <span className="mt-1 inline-block rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-700">
              {user?.role}
            </span>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <DisableRequestBanner />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
