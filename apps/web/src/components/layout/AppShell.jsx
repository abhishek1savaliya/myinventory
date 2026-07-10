'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu, MoreHorizontal } from 'lucide-react'
import { useAuth } from '@/contexts/use-auth'
import { DisableRequestBanner } from '@/components/users/DisableRequestBanner'
import { ChatNotificationStack } from '@/components/chat/ChatNotificationStack'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getNavItems } from '@/lib/nav-items'
import { orgDashboardPath } from '@/lib/org-paths'

function OrganizationBrand({ organization, compact = false }) {
  if (!organization) {
    return (
      <div className="min-w-0">
        <p className={cn('font-semibold text-[var(--color-primary)]', compact ? 'text-base' : 'text-lg')}>
          MyInventory
        </p>
      </div>
    )
  }

  const displayName = organization.tradingName || organization.name
  const showSecondaryName =
    organization.name && organization.tradingName && organization.name !== organization.tradingName

  return (
    <div className="flex min-w-0 items-center gap-3">
      {organization.logoUrl ? (
        <img
          src={organization.logoUrl}
          alt=""
          className={cn(
            'shrink-0 rounded-md border border-[var(--color-sidebar-border)] bg-white object-contain',
            compact ? 'h-9 w-9' : 'h-11 w-11',
          )}
        />
      ) : (
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]',
            compact ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base',
          )}
          aria-hidden
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p
          className={cn(
            'truncate font-semibold text-[var(--color-primary)]',
            compact ? 'text-base' : 'text-lg',
          )}
        >
          {displayName}
        </p>
        {showSecondaryName && (
          <p className="truncate text-xs text-[var(--color-muted)]">{organization.name}</p>
        )}
      </div>
    </div>
  )
}

function NavLink({ href, label, icon: Icon, isActive, onNavigate, compact }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center rounded-md text-sm font-medium text-gray-700 transition-colors',
        compact
          ? 'min-w-0 flex-1 flex-col gap-0.5 px-1 py-2 text-[10px]'
          : 'mb-0.5 gap-2.5 px-3 py-2',
        isActive
          ? compact
            ? 'text-[var(--color-primary)]'
            : 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
          : compact
            ? 'text-gray-600'
            : 'hover:bg-gray-100',
      )}
    >
      <Icon className={cn('shrink-0', compact ? 'h-5 w-5' : 'h-4 w-4')} />
      <span className={cn(compact && 'truncate')}>{label}</span>
    </Link>
  )
}

function SidebarContent({
  pathname,
  dashboardHref,
  visibleNavItems,
  user,
  logout,
  onNavigate,
  showHeader = true,
}) {
  return (
    <>
      {showHeader && (
        <div className="border-b border-[var(--color-sidebar-border)] px-4 py-4">
          <OrganizationBrand organization={user?.organization} />
        </div>
      )}
      <nav className="flex-1 overflow-y-auto p-2">
        {visibleNavItems.map(({ href, label, icon }) => {
          const isActive =
            href === dashboardHref ? pathname === dashboardHref : pathname.startsWith(href)
          return (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={icon}
              isActive={isActive}
              onNavigate={onNavigate}
            />
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
    </>
  )
}

export function AppShell({ orgSlug, children }) {
  const pathname = usePathname()
  const { user, logout, hasFeature } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const dashboardHref = orgDashboardPath(orgSlug)
  const visibleNavItems = getNavItems(orgSlug).filter((item) => hasFeature(item.feature))
  const mobileNavItems = visibleNavItems.slice(0, 4)
  const hasMoreNavItems = visibleNavItems.length > 4

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] lg:flex">
        <SidebarContent
          pathname={pathname}
          dashboardHref={dashboardHref}
          visibleNavItems={visibleNavItems}
          user={user}
          logout={logout}
        />
      </aside>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] shadow-xl lg:hidden">
            <SidebarContent
              pathname={pathname}
              dashboardHref={dashboardHref}
              visibleNavItems={visibleNavItems}
              user={user}
              logout={logout}
              onNavigate={closeMobileMenu}
            />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 lg:hidden">
          <OrganizationBrand organization={user?.organization} compact />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </header>

        <DisableRequestBanner />

        <ChatNotificationStack />

        <main className="main-content flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-6">
          {children}
        </main>

        {visibleNavItems.length > 0 && (
          <nav
            className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-surface)] lg:hidden"
            aria-label="Mobile navigation"
          >
            {mobileNavItems.map(({ href, label, icon }) => {
              const isActive =
                href === dashboardHref ? pathname === dashboardHref : pathname.startsWith(href)
              return (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  isActive={isActive}
                  compact
                />
              )
            })}
            {hasMoreNavItems && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium text-gray-600"
              >
                <MoreHorizontal className="h-5 w-5 shrink-0" />
                <span>More</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}
