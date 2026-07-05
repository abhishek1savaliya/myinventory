'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserRole } from '@myinventory/shared'
import { apiFetch, ApiRequestError } from '@/lib/api-client'
import { useAuth } from '@/contexts/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/ui/status-badge'

const emptyForm = {
  code: '',
  name: '',
  address: '',
}

export function WarehousesPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole(UserRole.ADMIN, UserRole.MANAGER)

  const [warehouses, setWarehouses] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' })
      if (search.trim()) params.set('search', search.trim())

      const response = await apiFetch(`/api/warehouses?${params.toString()}`)
      setWarehouses(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load warehouses')
    } finally {
      setIsLoading(false)
    }
  }, [search])

  useEffect(() => {
    void loadWarehouses()
  }, [loadWarehouses])

  function openCreate() {
    setEditingWarehouse(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(warehouse) {
    setEditingWarehouse(warehouse)
    setForm({
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address ?? '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    setIsSaving(true)

    const payload = {
      code: form.code,
      name: form.name,
      address: form.address || undefined,
    }

    try {
      if (editingWarehouse) {
        await apiFetch(`/api/warehouses/${editingWarehouse.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch('/api/warehouses', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      await loadWarehouses()
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Failed to save warehouse')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Warehouses</h2>
          <p className="text-sm text-[var(--color-muted)]">Manage distribution centres and storage sites</p>
        </div>
        {canManage && <Button onClick={openCreate}>Add warehouse</Button>}
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search by code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button variant="outline" onClick={() => void loadWarehouses()}>
          Search
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading warehouses...</p>
      ) : warehouses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">No warehouses found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Code</th>
                <th className="px-4 py-3 font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 font-medium text-gray-700">Address</th>
                <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                {canManage && <th className="px-4 py-3 font-medium text-gray-700">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {warehouses.map((warehouse) => (
                <tr key={warehouse.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3 font-medium">{warehouse.code}</td>
                  <td className="px-4 py-3">{warehouse.name}</td>
                  <td className="px-4 py-3">{warehouse.address ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={warehouse.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => openEdit(warehouse)}>
                        Edit
                      </Button>
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
        title={editingWarehouse ? 'Edit warehouse' : 'Add warehouse'}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Warehouse code</Label>
            <Input
              id="code"
              placeholder="MEL-01"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Warehouse name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
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
