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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="h-full" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
