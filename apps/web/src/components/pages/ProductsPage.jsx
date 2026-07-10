'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserRole } from '@myinventory/shared'
import { apiFetch, ApiRequestError } from '@/lib/api-client'
import { useAuth } from '@/contexts/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { PageLoader } from '@/components/ui/loader'
import { StatusBadge } from '@/components/ui/status-badge'

const emptyForm = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category: '',
  minimumStockLevel: '0',
}

export function ProductsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole(UserRole.ADMIN, UserRole.MANAGER)

  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' })
      if (search.trim()) params.set('search', search.trim())

      const response = await apiFetch(`/api/products?${params.toString()}`)
      setProducts(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setIsLoading(false)
    }
  }, [search])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  function openCreate() {
    setEditingProduct(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(product) {
    setEditingProduct(product)
    setForm({
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      description: product.description ?? '',
      category: product.category ?? '',
      minimumStockLevel: String(product.minimumStockLevel),
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    setIsSaving(true)

    const payload = {
      sku: form.sku,
      barcode: form.barcode,
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      minimumStockLevel: Number(form.minimumStockLevel) || 0,
    }

    try {
      if (editingProduct) {
        await apiFetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      await loadProducts()
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Failed to save product')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDisable(product) {
    if (!confirm(`Disable product ${product.sku}?`)) return

    try {
      await apiFetch(`/api/products/${product.id}/disable`, { method: 'PATCH' })
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable product')
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Products</h2>
          <p className="text-sm text-[var(--color-muted)]">Manage product catalogue and barcodes</p>
        </div>
        {canManage && <Button onClick={openCreate}>Add product</Button>}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search by SKU, barcode, or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-md"
        />
        <Button variant="outline" onClick={() => void loadProducts()}>
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
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">No products found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">SKU</th>
                <th className="px-4 py-3 font-medium text-gray-700">Barcode</th>
                <th className="px-4 py-3 font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 font-medium text-gray-700">Category</th>
                <th className="px-4 py-3 font-medium text-gray-700">Min stock</th>
                <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                {canManage && <th className="px-4 py-3 font-medium text-gray-700">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-medium">{product.sku}</td>
                  <td className="px-4 py-3 font-mono text-xs">{product.barcode}</td>
                  <td className="px-4 py-3">{product.name}</td>
                  <td className="px-4 py-3">{product.category ?? '—'}</td>
                  <td className="px-4 py-3">{product.minimumStockLevel}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={product.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                          Edit
                        </Button>
                        {product.status === 'ACTIVE' && (
                          <Button variant="ghost" size="sm" onClick={() => void handleDisable(product)}>
                            Disable
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingProduct ? 'Edit product' : 'Add product'}
        description="SKU and barcode must be unique across the catalogue."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={form.barcode}
                onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Product name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStock">Minimum stock</Label>
              <Input
                id="minStock"
                type="number"
                min={0}
                value={form.minimumStockLevel}
                onChange={(e) => setForm((f) => ({ ...f, minimumStockLevel: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
