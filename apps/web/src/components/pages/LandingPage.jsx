'use client'

import Link from 'next/link'
import {
  ArrowLeftRight,
  Boxes,
  Camera,
  CheckCircle2,
  Hand,
  History,
  MapPin,
  Package,
  ScanLine,
  Shield,
  Smartphone,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { useAuth } from '@/contexts/use-auth'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: ScanLine,
    title: 'Barcode scanning',
    description:
      'Scan products with your phone or laptop camera. Add new items with photos instantly when a barcode is not in the system.',
  },
  {
    icon: Package,
    title: 'Product catalogue',
    description:
      'Manage SKUs, barcodes, categories, and up to 10 photos per product. Keep your warehouse catalogue organised.',
  },
  {
    icon: Boxes,
    title: 'Inventory tracking',
    description:
      'See stock levels across warehouses and locations. Know what you have and where it is stored.',
  },
  {
    icon: Truck,
    title: 'Receiving',
    description: 'Record incoming stock when shipments arrive and update inventory in real time.',
  },
  {
    icon: Hand,
    title: 'Picking',
    description: 'Fulfill orders by picking items from locations with a clear audit trail.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Stock movement',
    description: 'Move stock between locations or warehouses without losing track of quantities.',
  },
  {
    icon: Warehouse,
    title: 'Warehouses & locations',
    description: 'Set up multiple warehouses with zones, aisles, racks, and bins for precise storage.',
  },
  {
    icon: History,
    title: 'Transaction history',
    description: 'Every receive, pick, move, and adjustment is logged with user and timestamp.',
  },
  {
    icon: Users,
    title: 'Roles & permissions',
    description:
      'Admin, manager, warehouse user, and picker roles. Grant extra features like scan or delete per user.',
  },
  {
    icon: Smartphone,
    title: 'Mobile ready',
    description:
      'Works on phones and tablets — rear camera scanning, flashlight support, and responsive layout.',
  },
  {
    icon: Shield,
    title: 'Secure access',
    description: 'Sign in with your account. Sessions are stored securely and access is role-based.',
  },
  {
    icon: Camera,
    title: 'Product photos',
    description: 'Capture or upload images during scanning. Compress and store photos in the cloud.',
  },
]

const steps = [
  {
    step: '1',
    title: 'Sign in',
    description: 'Use the credentials provided by your administrator to access MyInventory.',
  },
  {
    step: '2',
    title: 'Scan or search',
    description: 'Open Scan to read a barcode with your camera, or browse Products and Inventory.',
  },
  {
    step: '3',
    title: 'Manage stock',
    description: 'Receive goods, pick orders, move items between locations, and adjust quantities.',
  },
  {
    step: '4',
    title: 'Track & report',
    description: 'Review the dashboard and transaction logs to see activity across your warehouse.',
  },
]

const roles = [
  {
    name: 'Admin',
    detail: 'Full access — users, settings, catalogue, inventory, and all warehouse operations.',
  },
  {
    name: 'Manager',
    detail: 'Manage products, inventory, warehouses, and day-to-day operations.',
  },
  {
    name: 'Warehouse user',
    detail: 'Receive, pick, move stock, and manage inventory at assigned locations.',
  },
  {
    name: 'Picker',
    detail: 'Focused access for scanning, receiving, picking, and stock movement tasks.',
  },
]

export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth()

  return (
    <div className="min-h-full bg-[var(--color-background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--color-primary)]">MyInventory</p>
              <p className="text-xs text-[var(--color-muted)]">Warehouse Management</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button asChild>
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[var(--color-border)] bg-gradient-to-b from-white to-[var(--color-background)] px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-primary)]">
                Warehouse inventory system
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Manage stock, scan barcodes, and run your warehouse from anywhere
              </h1>
              <p className="mt-5 text-lg text-[var(--color-muted)] sm:text-xl">
                MyInventory helps teams track products, locations, and stock movements with barcode
                scanning, role-based access, and a mobile-friendly web app built for real warehouse
                work.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {!isLoading && isAuthenticated ? (
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/dashboard">Go to dashboard</Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/login">Sign in to get started</Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <a href="#features">Explore features</a>
                </Button>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Scan', icon: ScanLine },
                { label: 'Inventory', icon: Boxes },
                { label: 'Locations', icon: MapPin },
                { label: 'History', icon: History },
              ].map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-center shadow-sm"
                >
                  <Icon className="mx-auto mb-2 h-6 w-6 text-[var(--color-primary)]" />
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Everything you need</h2>
              <p className="mt-2 text-[var(--color-muted)]">
                From scanning a barcode on the floor to reviewing transaction history in the office —
                MyInventory covers the full warehouse workflow.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-sidebar-active)]">
                    <Icon className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--color-border)] bg-white px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">How to use MyInventory</h2>
              <p className="mt-2 text-[var(--color-muted)]">
                Get started in minutes. Your admin creates your account — then you sign in and begin
                working.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ step, title, description }) => (
                <div key={step} className="relative rounded-xl border border-[var(--color-border)] p-5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                    {step}
                  </span>
                  <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Built for your team</h2>
              <p className="mt-2 text-[var(--color-muted)]">
                Different roles see different parts of the app. Admins can grant extra permissions like
                scan access or product delete when needed.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {roles.map(({ name, detail }) => (
                <div
                  key={name}
                  className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-white p-5"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--color-primary)] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to manage your warehouse?</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">
              Sign in with your account to scan barcodes, update inventory, and keep your team in sync.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {!isLoading && isAuthenticated ? (
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-white text-[var(--color-primary)] hover:bg-gray-100 sm:w-auto"
                >
                  <Link href="/dashboard">Open dashboard</Link>
                </Button>
              ) : (
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-white text-[var(--color-primary)] hover:bg-gray-100 sm:w-auto"
                >
                  <Link href="/login">Sign in now</Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-[var(--color-muted)]">© {new Date().getFullYear()} MyInventory</p>
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="text-[var(--color-primary)] hover:underline">
              Sign in
            </Link>
            {!isLoading && isAuthenticated && (
              <Link href="/dashboard" className="text-[var(--color-primary)] hover:underline">
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
