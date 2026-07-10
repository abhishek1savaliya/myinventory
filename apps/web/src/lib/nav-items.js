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
} from 'lucide-react'
import { AppFeature } from '@myinventory/shared'
import { orgPath } from '@/lib/org-paths'

export function getNavItems(orgSlug) {
  return [
    { href: orgPath(orgSlug, 'dashboard'), label: 'Dashboard', icon: LayoutDashboard, feature: AppFeature.DASHBOARD },
    { href: orgPath(orgSlug, 'scan'), label: 'Scan', icon: ScanLine, feature: AppFeature.SCAN },
    { href: orgPath(orgSlug, 'products'), label: 'Products', icon: Package, feature: AppFeature.PRODUCTS },
    { href: orgPath(orgSlug, 'inventory'), label: 'Inventory', icon: Boxes, feature: AppFeature.INVENTORY },
    { href: orgPath(orgSlug, 'receiving'), label: 'Receiving', icon: Truck, feature: AppFeature.RECEIVING },
    { href: orgPath(orgSlug, 'picking'), label: 'Picking', icon: Hand, feature: AppFeature.PICKING },
    { href: orgPath(orgSlug, 'movement'), label: 'Stock Movement', icon: ArrowLeftRight, feature: AppFeature.MOVEMENT },
    { href: orgPath(orgSlug, 'warehouses'), label: 'Warehouses', icon: Warehouse, feature: AppFeature.WAREHOUSES },
    { href: orgPath(orgSlug, 'locations'), label: 'Locations', icon: MapPin, feature: AppFeature.LOCATIONS },
    { href: orgPath(orgSlug, 'transactions'), label: 'Transactions', icon: History, feature: AppFeature.TRANSACTIONS },
    { href: orgPath(orgSlug, 'users'), label: 'Users', icon: Users, feature: AppFeature.USERS },
    { href: orgPath(orgSlug, 'settings'), label: 'Settings', icon: Settings, feature: AppFeature.SETTINGS },
  ]
}
