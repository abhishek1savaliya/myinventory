'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, RotateCcw, ScanLine } from 'lucide-react'
import { apiFetch, ApiRequestError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'

const emptyForm = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category: '',
  minimumStockLevel: '0',
}

export function ScanPage() {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)

  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [isScannerActive, setIsScannerActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [manualBarcode, setManualBarcode] = useState('')

  const [scanState, setScanState] = useState('idle')
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [product, setProduct] = useState(null)
  const [lookupError, setLookupError] = useState(null)
  const [isLookingUp, setIsLookingUp] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [imagePreview, setImagePreview] = useState(null)
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null

    const video = videoRef.current
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }

    setIsScannerActive(false)
  }, [])

  const lookupBarcode = useCallback(
    async (barcode) => {
      const trimmed = barcode.trim()
      if (!trimmed) return

      stopScanner()
      setScannedBarcode(trimmed)
      setLookupError(null)
      setProduct(null)
      setIsLookingUp(true)
      setScanState('looking-up')

      try {
        const response = await apiFetch(`/api/products/barcode/${encodeURIComponent(trimmed)}`)
        setProduct(response.data)
        setScanState('found')
      } catch (err) {
        if (err instanceof ApiRequestError && err.statusCode === 404) {
          setForm({
            ...emptyForm,
            barcode: trimmed,
            sku: trimmed,
          })
          setImagePreview(null)
          setFormError(null)
          setScanState('not-found')
        } else {
          setLookupError(err instanceof Error ? err.message : 'Failed to look up product')
          setScanState('error')
        }
      } finally {
        setIsLookingUp(false)
      }
    },
    [stopScanner],
  )

  const startScanner = useCallback(
    async (deviceId) => {
      setCameraError(null)
      setScanState('scanning')

      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()

        if (!videoRef.current) {
          throw new Error('Camera preview is not ready')
        }

        const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
          if (result) {
            void lookupBarcode(result.getText())
          }
        })

        controlsRef.current = controls
        setIsScannerActive(true)
      } catch (err) {
        setCameraError(
          err instanceof Error
            ? err.message
            : 'Unable to access camera. Check browser permissions or choose another camera.',
        )
        setScanState('idle')
        stopScanner()
      }
    },
    [lookupBarcode, stopScanner],
  )

  useEffect(() => {
    let cancelled = false

    async function initCameras() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        if (cancelled) return

        setCameras(devices)

        const preferredDevice =
          devices.find((device) => /back|rear|environment/i.test(device.label)) ??
          devices[devices.length - 1] ??
          devices[0]

        if (preferredDevice) {
          setSelectedCameraId(preferredDevice.deviceId)
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError(
            err instanceof Error ? err.message : 'Unable to list cameras for this device.',
          )
        }
      }
    }

    void initCameras()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedCameraId) return

    void startScanner(selectedCameraId)

    return () => {
      stopScanner()
    }
  }, [selectedCameraId, startScanner, stopScanner])

  function resetScan() {
    stopScanner()
    setScannedBarcode('')
    setProduct(null)
    setLookupError(null)
    setForm(emptyForm)
    setImagePreview(null)
    setFormError(null)
    setManualBarcode('')
    setScanState('idle')
    if (selectedCameraId) {
      void startScanner(selectedCameraId)
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0)
    setImagePreview(canvas.toDataURL('image/jpeg', 0.85))
  }

  function handleImageFile(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagePreview(reader.result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  async function handleCreateProduct() {
    setFormError(null)
    setIsSaving(true)

    const payload = {
      sku: form.sku.trim() || form.barcode.trim(),
      barcode: form.barcode.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      minimumStockLevel: Number(form.minimumStockLevel) || 0,
      imageBase64: imagePreview || undefined,
    }

    try {
      const response = await apiFetch('/api/products/from-scan', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setProduct(response.data)
      setScanState('found')
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Failed to create product')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-2xl font-semibold text-gray-900">Scan</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Scan a barcode with your camera. If the product exists, details will appear. Otherwise you
          can add it with a photo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScanLine className="h-5 w-5" />
              Camera scanner
            </CardTitle>
            <CardDescription>
              On mobile, the rear camera is used when available. On laptop, pick a camera below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameras.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="camera-select">Camera</Label>
                <select
                  id="camera-select"
                  className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                  value={selectedCameraId}
                  onChange={(event) => {
                    stopScanner()
                    setSelectedCameraId(event.target.value)
                  }}
                >
                  {cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-black">
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full object-cover"
                muted
                playsInline
              />
              {isScannerActive && scanState === 'scanning' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-40 w-64 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              )}
            </div>

            {cameraError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{cameraError}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={resetScan}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Scan again
              </Button>
              {scanState === 'not-found' && (
                <Button type="button" variant="outline" onClick={capturePhoto}>
                  <Camera className="mr-2 h-4 w-4" />
                  Capture photo
                </Button>
              )}
            </div>

            <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
              <Label htmlFor="manual-barcode">Manual barcode entry</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-barcode"
                  placeholder="Type or paste barcode"
                  value={manualBarcode}
                  onChange={(event) => setManualBarcode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void lookupBarcode(manualBarcode)
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => void lookupBarcode(manualBarcode)}
                  disabled={!manualBarcode.trim() || isLookingUp}
                >
                  Look up
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {scanState === 'looking-up' && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-[var(--color-muted)]">
                Looking up barcode {scannedBarcode}…
              </CardContent>
            </Card>
          )}

          {scanState === 'error' && lookupError && (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-red-700">{lookupError}</p>
                <Button className="mt-4" type="button" onClick={resetScan}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          )}

          {scanState === 'found' && product && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Product found</CardTitle>
                <CardDescription>Barcode {product.barcode}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="max-h-56 w-full rounded-lg border border-[var(--color-border)] object-contain bg-gray-50"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 text-sm text-[var(--color-muted)]">
                    No product image
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{product.name}</span>
                    <StatusBadge status={product.status} />
                  </div>
                  <p>
                    <span className="text-[var(--color-muted)]">SKU:</span> {product.sku}
                  </p>
                  {product.category && (
                    <p>
                      <span className="text-[var(--color-muted)]">Category:</span> {product.category}
                    </p>
                  )}
                  {product.description && (
                    <p>
                      <span className="text-[var(--color-muted)]">Description:</span>{' '}
                      {product.description}
                    </p>
                  )}
                  <p>
                    <span className="text-[var(--color-muted)]">Min stock:</span>{' '}
                    {product.minimumStockLevel}
                  </p>
                </div>

                <Button type="button" onClick={resetScan}>
                  Scan another
                </Button>
              </CardContent>
            </Card>
          )}

          {scanState === 'not-found' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Product not found</CardTitle>
                <CardDescription>
                  Barcode {scannedBarcode} is not in the system. Add product details below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Product image</Label>
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      className="max-h-48 w-full rounded-lg border border-[var(--color-border)] object-contain bg-gray-50"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 text-sm text-[var(--color-muted)]">
                      Capture from camera or upload an image
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={capturePhoto}>
                      <Camera className="mr-2 h-4 w-4" />
                      Capture
                    </Button>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleImageFile}
                      />
                      <ImagePlus className="h-4 w-4" />
                      Upload
                    </label>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="scan-barcode">Barcode</Label>
                    <Input id="scan-barcode" value={form.barcode} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scan-sku">SKU</Label>
                    <Input
                      id="scan-sku"
                      value={form.sku}
                      onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="scan-name">Product name</Label>
                    <Input
                      id="scan-name"
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Required"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="scan-description">Description</Label>
                    <Input
                      id="scan-description"
                      value={form.description}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scan-category">Category</Label>
                    <Input
                      id="scan-category"
                      value={form.category}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, category: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scan-min-stock">Minimum stock</Label>
                    <Input
                      id="scan-min-stock"
                      type="number"
                      min="0"
                      value={form.minimumStockLevel}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, minimumStockLevel: event.target.value }))
                      }
                    />
                  </div>
                </div>

                {formError && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleCreateProduct()}
                    disabled={!form.name.trim() || isSaving}
                  >
                    {isSaving ? 'Adding…' : 'Add product'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetScan}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {scanState === 'idle' && !cameraError && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-[var(--color-muted)]">
                Starting camera…
              </CardContent>
            </Card>
          )}

          {scanState === 'scanning' && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-[var(--color-muted)]">
                Point the camera at a barcode. Scanning supports common 1D and 2D formats.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
