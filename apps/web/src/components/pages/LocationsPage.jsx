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
  warehouseId: '',
  code: '',
  zone: '',
  aisle: '',
  rack: '',
  shelf: '',
  bin: '',
}

export function LocationsPage() {
  const { hasRole } = useAuth()
  const canManage = hasRole(UserRole.ADMIN, UserRole.MANAGER)

  const [locations, setLocations] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadWarehouses = useCallback(async () => {
    const response = await apiFetch('/api/warehouses?page=1&pageSize=100')
    setWarehouses(response.data)
  }, [])

  const loadLocations = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' })
      if (search.trim()) params.set('search', search.trim())
      if (warehouseFilter) params.set('warehouseId', warehouseFilter)

      const response = await apiFetch(`/api/locations?${params.toString()}`)
      setLocations(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations')
    } finally {
      setIsLoading(false)
    }
  }, [search, warehouseFilter])

  useEffect(() => {
    void loadWarehouses()
  }, [loadWarehouses])

  useEffect(() => {
    void loadLocations()
  }, [loadLocations])

  function openCreate() {
    setEditingLocation(null)
    setForm({
      ...emptyForm,
      warehouseId: warehouseFilter || warehouses[0]?.id || '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(location) {
    setEditingLocation(location)
    setForm({
      warehouseId: location.warehouseId,
      code: location.code,
      zone: location.zone ?? '',
      aisle: location.aisle ?? '',
      rack: location.rack ?? '',
      shelf: location.shelf ?? '',
      bin: location.bin ?? '',
    })
    setFormError(null)
    setDialogOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    setIsSaving(true)

    try {
      if (editingLocation) {
        await apiFetch(`/api/locations/${editingLocation.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            code: form.code,
            zone: form.zone || undefined,
            aisle: form.aisle || undefined,
            rack: form.rack || undefined,
            shelf: form.shelf || undefined,
            bin: form.bin || undefined,
          }),
        })
      } else {
        await apiFetch('/api/locations', {
          method: 'POST',
          body: JSON.stringify({
            warehouseId: form.warehouseId,
            code: form.code,
            zone: form.zone || undefined,
            aisle: form.aisle || undefined,
            rack: form.rack || undefined,
            shelf: form.shelf || undefined,
            bin: form.bin || undefined,
          }),
        })
      }

      setDialogOpen(false)
      await loadLocations()
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Failed to save location')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Locations</h2>
          <p className="text-sm text-[var(--color-muted)]">Manage warehouse bins and storage locations</p>
        </div>
        {canManage && <Button onClick={openCreate}>Add location</Button>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Search by location code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="h-10 rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
        >
          <option value="">All warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={() => void loadLocations()}>
          Search
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading locations...</p>
      ) : locations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-white p-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">No locations found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Warehouse</th>
                <th className="px-4 py-3 font-medium text-gray-700">Location</th>
                <th className="px-4 py-3 font-medium text-gray-700">Zone</th>
                <th className="px-4 py-3 font-medium text-gray-700">Aisle</th>
                <th className="px-4 py-3 font-medium text-gray-700">Bin</th>
                <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                {canManage && <th className="px-4 py-3 font-medium text-gray-700">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-3">{location.warehouseCode}</td>
                  <td className="px-4 py-3 font-medium">{location.code}</td>
                  <td className="px-4 py-3">{location.zone ?? '—'}</td>
                  <td className="px-4 py-3">{location.aisle ?? '—'}</td>
                  <td className="px-4 py-3">{location.bin ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={location.status} />
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => openEdit(location)}>
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
        title={editingLocation ? 'Edit location' : 'Add location'}
        description="Location codes must be unique within each warehouse."
      >
        <div className="space-y-4">
          {!editingLocation && (
            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <select
                id="warehouse"
                value={form.warehouseId}
                onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value }))}
                className="h-10 w-full rounded-md border border-[var(--color-border)] bg-white px-3 text-sm"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="code">Location code</Label>
            <Input
              id="code"
              placeholder="A-01-02"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="zone">Zone</Label>
              <Input
                id="zone"
                value={form.zone}
                onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aisle">Aisle</Label>
              <Input
                id="aisle"
                value={form.aisle}
                onChange={(e) => setForm((f) => ({ ...f, aisle: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rack">Rack</Label>
              <Input
                id="rack"
                value={form.rack}
                onChange={(e) => setForm((f) => ({ ...f, rack: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shelf">Shelf</Label>
              <Input
                id="shelf"
                value={form.shelf}
                onChange={(e) => setForm((f) => ({ ...f, shelf: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bin">Bin</Label>
              <Input
                id="bin"
                value={form.bin}
                onChange={(e) => setForm((f) => ({ ...f, bin: e.target.value }))}
              />
            </div>
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
