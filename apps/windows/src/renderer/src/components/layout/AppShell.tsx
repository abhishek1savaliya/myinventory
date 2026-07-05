import { AppFeature } from '@myinventory/shared'
import {
  LayoutDashboard,
  ScanLine,
  Package,
  Boxes,
  Truck,
  Hand,
  ArrowLeftRight,
  Warehouse,
  MapPin,
  History,
  Users,
  Settings,
  LogOut,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@renderer/contexts/use-auth'
import { DisableRequestBanner } from '@renderer/components/users/DisableRequestBanner'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'

export const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, feature: AppFeature.DASHBOARD },
  { to: '/scan', label: 'Scan', icon: ScanLine, feature: AppFeature.SCAN },
  { to: '/products', label: 'Products', icon: Package, feature: AppFeature.PRODUCTS },
  { to: '/inventory', label: 'Inventory', icon: Boxes, feature: AppFeature.INVENTORY },
  { to: '/receiving', label: 'Receiving', icon: Truck, feature: AppFeature.RECEIVING },
  { to: '/picking', label: 'Picking', icon: Hand, feature: AppFeature.PICKING },
  { to: '/movement', label: 'Stock Movement', icon: ArrowLeftRight, feature: AppFeature.MOVEMENT },
  { to: '/warehouses', label: 'Warehouses', icon: Warehouse, feature: AppFeature.WAREHOUSES },
  { to: '/locations', label: 'Locations', icon: MapPin, feature: AppFeature.LOCATIONS },
  { to: '/transactions', label: 'Transactions', icon: History, feature: AppFeature.TRANSACTIONS },
  { to: '/users', label: 'Users', icon: Users, feature: AppFeature.USERS },
  { to: '/settings', label: 'Settings', icon: Settings, feature: AppFeature.SETTINGS },
] as const

export function AppShell() {
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
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors',
                  isActive
                    ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
                    : 'hover:bg-gray-100',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
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
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
