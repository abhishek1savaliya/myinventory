'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/loader'

export function InventoryPage() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadInventory = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' })
      if (search.trim()) params.set('search', search.trim())

      const response = await apiFetch(`/api/inventory?${params.toString()}`)
      setItems(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setIsLoading(false)
    }
  }, [search])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Inventory</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Stock levels by product, warehouse, and location
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search SKU, barcode, or product name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-md"
        />
        <Button variant="outline" onClick={() => void loadInventory()}>
          Search
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">No inventory records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">SKU</th>
                <th className="px-4 py-3 font-medium text-gray-700">Product</th>
                <th className="px-4 py-3 font-medium text-gray-700">Warehouse</th>
                <th className="px-4 py-3 font-medium text-gray-700">Location</th>
                <th className="px-4 py-3 font-medium text-gray-700">On hand</th>
                <th className="px-4 py-3 font-medium text-gray-700">Reserved</th>
                <th className="px-4 py-3 font-medium text-gray-700">Available</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-medium">{item.sku}</td>
                  <td className="px-4 py-3">{item.productName}</td>
                  <td className="px-4 py-3">{item.warehouseCode}</td>
                  <td className="px-4 py-3">{item.locationCode}</td>
                  <td className="px-4 py-3 font-medium">{item.quantity}</td>
                  <td className="px-4 py-3">{item.reservedQuantity}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-primary)]">
                    {item.availableQuantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
