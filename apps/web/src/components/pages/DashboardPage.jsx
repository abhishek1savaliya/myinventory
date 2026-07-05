'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'
import { formatDateTime, isSameUtcDay } from '@/lib/utils'

export function DashboardPage() {
  const [inventoryCount, setInventoryCount] = useState(null)
  const [totalQuantity, setTotalQuantity] = useState(null)
  const [recentTransactions, setRecentTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [inventoryRes, txRes] = await Promise.all([
          apiFetch('/api/inventory?page=1&pageSize=100'),
          apiFetch('/api/transactions?page=1&pageSize=10'),
        ])

        setInventoryCount(inventoryRes.total)
        setTotalQuantity(inventoryRes.data.reduce((sum, item) => sum + item.quantity, 0))
        setRecentTransactions(txRes.data)
      } catch {
        setInventoryCount(0)
        setTotalQuantity(0)
        setRecentTransactions([])
      } finally {
        setIsLoading(false)
      }
    }

    void loadDashboard()
  }, [])

  const todayReceived = recentTransactions
    .filter((tx) => {
      const isToday = isSameUtcDay(tx.createdAt, new Date())
      return isToday && tx.type === 'STOCK_RECEIVED'
    })
    .reduce((sum, tx) => sum + tx.quantity, 0)

  const todayPicked = recentTransactions
    .filter((tx) => {
      const isToday = isSameUtcDay(tx.createdAt, new Date())
      return isToday && tx.type === 'STOCK_PICKED'
    })
    .reduce((sum, tx) => sum + tx.quantity, 0)

  return (
    <div>
      <h2 className="mb-1 text-2xl font-semibold text-gray-900">Dashboard</h2>
      <p className="mb-6 text-sm text-[var(--color-muted)]">Warehouse overview</p>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Inventory records', value: inventoryCount },
          { label: 'Total quantity', value: totalQuantity },
          { label: "Today's received", value: todayReceived },
          { label: "Today's picked", value: todayPicked },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
          >
            <p className="text-sm text-[var(--color-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {isLoading ? '—' : (value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="font-medium text-gray-900">Recent transactions</h3>
          <Link href="/transactions" className="text-sm text-[var(--color-primary)] hover:underline">
            View all logs
          </Link>
        </div>
        {isLoading ? (
          <p className="p-4 text-sm text-[var(--color-muted)]">Loading...</p>
        ) : recentTransactions.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-muted)]">No transactions yet</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 font-medium text-gray-700">Date</th>
                <th className="px-4 py-2 font-medium text-gray-700">Type</th>
                <th className="px-4 py-2 font-medium text-gray-700">SKU</th>
                <th className="px-4 py-2 font-medium text-gray-700">Qty</th>
                <th className="px-4 py-2 font-medium text-gray-700">User</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {formatDateTime(tx.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-xs">{tx.type.replace('STOCK_', '')}</td>
                  <td className="px-4 py-2 font-medium">{tx.sku}</td>
                  <td className="px-4 py-2">{tx.quantity}</td>
                  <td className="px-4 py-2">{tx.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
