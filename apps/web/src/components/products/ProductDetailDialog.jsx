'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { formatDate, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PageLoader } from '@/components/ui/loader'
import { StatusBadge } from '@/components/ui/status-badge'

function DetailField({ label, value, mono = false }) {
  return (
    <div>
      <Label className="text-[var(--color-muted)]">{label}</Label>
      <p className={`mt-1 text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </p>
    </div>
  )
}

function ProductImageGallery({ images, imageUrl, productName }) {
  const photos = images?.length
    ? images
    : imageUrl
      ? [{ id: 'primary', url: imageUrl, sortOrder: 0 }]
      : []

  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 px-4 py-8 text-center text-sm text-[var(--color-muted)]">
        No photos for this product
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((image, index) => (
        <a
          key={image.id}
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group overflow-hidden rounded-lg border border-[var(--color-border)] bg-gray-50"
        >
          <img
            src={image.url}
            alt={`${productName} photo ${index + 1}`}
            className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
          />
        </a>
      ))}
    </div>
  )
}

export function ProductDetailDialog({ productId, open, onClose, onEdit, canManage }) {
  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !productId) {
      setProduct(null)
      setError(null)
      return
    }

    let cancelled = false

    async function loadProduct() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await apiFetch(`/api/products/${productId}`)
        if (!cancelled) {
          setProduct(response.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load product details')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProduct()

    return () => {
      cancelled = true
    }
  }, [open, productId])

  if (!open) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={product?.name ?? 'Product details'}
      description={product ? `${product.sku} · ${product.barcode}` : 'Loading product information'}
      className="sm:max-w-2xl"
    >
      {isLoading ? (
        <PageLoader className="py-8" />
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : product ? (
        <div className="space-y-6">
          <div>
            <Label className="mb-2 block text-[var(--color-muted)]">Photos</Label>
            <ProductImageGallery
              images={product.images}
              imageUrl={product.imageUrl}
              productName={product.name}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="SKU" value={product.sku} mono />
            <DetailField label="Barcode" value={product.barcode} mono />
            <DetailField label="Product name" value={product.name} />
            <DetailField label="Category" value={product.category} />
            <div>
              <Label className="text-[var(--color-muted)]">Status</Label>
              <div className="mt-1">
                <StatusBadge status={product.status} />
              </div>
            </div>
            <DetailField label="Minimum stock level" value={String(product.minimumStockLevel)} />
            <DetailField label="Created" value={formatDate(product.createdAt)} />
            <DetailField label="Last updated" value={formatDateTime(product.updatedAt)} />
          </div>

          {product.description && (
            <div>
              <Label className="text-[var(--color-muted)]">Description</Label>
              <p className="mt-1 text-sm leading-relaxed text-gray-900">{product.description}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {canManage && onEdit && (
              <Button
                onClick={() => {
                  onEdit(product)
                  onClose()
                }}
              >
                Edit product
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
