import { useCallback, useEffect, useState } from 'react'
import type { InventoryTransactionDto, PaginatedResponse, TransactionType } from '@myinventory/shared'
import { TransactionType as TransactionTypeEnum } from '@myinventory/shared'
import { apiFetch } from '@renderer/lib/api-client'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Button } from '@renderer/components/ui/button'

const TRANSACTION_TYPES = Object.values(TransactionTypeEnum)

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<InventoryTransactionDto[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [transactionId, setTransactionId] = useState('')
  const [sku, setSku] = useState('')
  const [type, setType] = useState<TransactionType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const loadTransactions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })

      if (transactionId.trim()) params.set('transactionId', transactionId.trim())
      if (sku.trim()) params.set('sku', sku.trim())
      if (type) params.set('type', type)
      if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        params.set('dateTo', end.toISOString())
      }

      const response = await apiFetch<PaginatedResponse<InventoryTransactionDto>>(
        `/api/transactions?${params.toString()}`,
      )
      setTransactions(response.data)
      setTotal(response.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, transactionId, sku, type, dateFrom, dateTo])

  useEffect(() => {
    void loadTransactions()
  }, [loadTransactions])

  function handleSearch() {
    setPage(1)
    void loadTransactions()
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Transactions</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Complete immutable audit log — all stock changes are recorded permanently
        </p>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="tx-id">Transaction ID</Label>
          <Input
            id="tx-id"
            placeholder="Search by ID..."
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tx-sku">SKU</Label>
          <Input
            id="tx-sku"
            placeholder="e.g. HH-100293"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tx-type">Type</Label>
          <select
            id="tx-type"
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType | '')}
            className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
          >
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('STOCK_', '')}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tx-from">Date from</Label>
          <Input
            id="tx-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tx-to">Date to</Label>
          <Input
            id="tx-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleSearch} className="w-full md:w-auto">
            Search
          </Button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm text-[var(--color-muted)]">
        <span>
          {total} transaction{total === 1 ? '' : 's'} total
        </span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading transactions...</p>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">No transactions found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Date</th>
                <th className="px-4 py-3 font-medium text-gray-700">ID</th>
                <th className="px-4 py-3 font-medium text-gray-700">Type</th>
                <th className="px-4 py-3 font-medium text-gray-700">SKU</th>
                <th className="px-4 py-3 font-medium text-gray-700">Product</th>
                <th className="px-4 py-3 font-medium text-gray-700">Qty</th>
                <th className="px-4 py-3 font-medium text-gray-700">From</th>
                <th className="px-4 py-3 font-medium text-gray-700">To</th>
                <th className="px-4 py-3 font-medium text-gray-700">User</th>
                <th className="px-4 py-3 font-medium text-gray-700">Reference</th>
                <th className="px-4 py-3 font-medium text-gray-700">Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500" title={tx.id}>
                    {tx.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
                      {tx.type.replace('STOCK_', '')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{tx.sku}</td>
                  <td className="px-4 py-3">{tx.productName}</td>
                  <td className="px-4 py-3">{tx.quantity}</td>
                  <td className="px-4 py-3 text-xs">
                    {tx.sourceWarehouseCode
                      ? `${tx.sourceWarehouseCode} / ${tx.sourceLocationCode}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {tx.destinationWarehouseCode
                      ? `${tx.destinationWarehouseCode} / ${tx.destinationLocationCode}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">{tx.userName}</td>
                  <td className="px-4 py-3 text-xs">{tx.reference ?? '—'}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs" title={tx.notes ?? ''}>
                    {tx.notes ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
