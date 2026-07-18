import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata = {
  title: 'MyInventory — Warehouse Inventory Management',
  description:
    'Scan barcodes, track stock, manage warehouses, and run receiving, picking, and stock movement from web and mobile.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// Removes any lingering service worker from a previous PWA build that could
// otherwise keep serving stale, cached JS chunks in users' browsers.
const serviceWorkerCleanup = `
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    regs.forEach(function (reg) { reg.unregister(); });
  }).catch(function () {});
  if (window.caches && caches.keys) {
    caches.keys().then(function (keys) {
      keys.forEach(function (key) { caches.delete(key); });
    }).catch(function () {});
  }
}
`

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerCleanup }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
