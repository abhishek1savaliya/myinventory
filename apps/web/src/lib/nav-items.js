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

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: AppFeature.DASHBOARD },
  { href: '/scan', label: 'Scan', icon: ScanLine, feature: AppFeature.SCAN },
  { href: '/products', label: 'Products', icon: Package, feature: AppFeature.PRODUCTS },
  { href: '/inventory', label: 'Inventory', icon: Boxes, feature: AppFeature.INVENTORY },
  { href: '/receiving', label: 'Receiving', icon: Truck, feature: AppFeature.RECEIVING },
  { href: '/picking', label: 'Picking', icon: Hand, feature: AppFeature.PICKING },
  { href: '/movement', label: 'Stock Movement', icon: ArrowLeftRight, feature: AppFeature.MOVEMENT },
  { href: '/warehouses', label: 'Warehouses', icon: Warehouse, feature: AppFeature.WAREHOUSES },
  { href: '/locations', label: 'Locations', icon: MapPin, feature: AppFeature.LOCATIONS },
  { href: '/transactions', label: 'Transactions', icon: History, feature: AppFeature.TRANSACTIONS },
  { href: '/users', label: 'Users', icon: Users, feature: AppFeature.USERS },
  { href: '/settings', label: 'Settings', icon: Settings, feature: AppFeature.SETTINGS },
]
