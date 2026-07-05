'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, RotateCcw, ScanLine, Trash2 } from 'lucide-react'
import { AppFeature, UserRole } from '@myinventory/shared'
import { apiFetch, ApiRequestError } from '@/lib/api-client'
import { useAuth } from '@/contexts/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'

import { initScanAudio, playScanBeep } from '@/lib/scan-sound'
import { compressImageDataUrl, compressImageFile } from '@/lib/compress-image'

const emptyForm = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category: '',
  minimumStockLevel: '0',
}

function formatApiError(err) {
  if (err instanceof ApiRequestError) {
    if (err.details?.fieldErrors) {
      return Object.entries(err.details.fieldErrors)
        .flatMap(([field, messages]) =>
          (messages ?? []).map((message) => `${field}: ${message}`),
        )
        .join('. ')
    }
    if (Array.isArray(err.details) && err.details.length > 0) {
      return err.details.map((item) => item.message).join('. ')
    }
    return err.message
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

function shouldProcessScan(barcode, lastScanRef) {
  const now = Date.now()
  if (lastScanRef.current.barcode === barcode && now - lastScanRef.current.at < 2500) {
    return false
  }
  lastScanRef.current = { barcode, at: now }
  return true
}

function productToForm(product) {
  return {
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    description: product.description ?? '',
    category: product.category ?? '',
    minimumStockLevel: String(product.minimumStockLevel),
  }
}

export function ScanPage() {
  const { hasRole, hasFeature } = useAuth()
  const canDelete =
    hasRole(UserRole.ADMIN, UserRole.MANAGER) || hasFeature(AppFeature.PRODUCT_DELETE)
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const scanningRef = useRef(false)
  const lastScanRef = useRef({ barcode: '', at: 0 })
  const resultRef = useRef(null)

  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const [cameraStarted, setCameraStarted] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
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
  const [isCompressingImage, setIsCompressingImage] = useState(false)

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
      if (!trimmed || !shouldProcessScan(trimmed, lastScanRef)) return

      stopScanner()
      setScannedBarcode(trimmed)
      setLookupError(null)
      setProduct(null)
      setIsLookingUp(true)
      setScanState('looking-up')

      try {
        const response = await apiFetch(`/api/products/barcode/${encodeURIComponent(trimmed)}`)
        setProduct(response.data)
        setForm(productToForm(response.data))
        setImagePreview(null)
        setScanState('found')
        playScanBeep('found')
      } catch (err) {
        if (err instanceof ApiRequestError && err.statusCode === 404) {
          setForm({
            ...emptyForm,
            barcode: trimmed,
            sku: trimmed,
            name: `Product ${trimmed}`,
          })
          setImagePreview(null)
          setFormError(null)
          setScanState('not-found')
          playScanBeep('not-found')
        } else {
          setLookupError(formatApiError(err))
          setScanState('error')
        }
      } finally {
        setIsLookingUp(false)
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }
    },
    [stopScanner],
  )

  const refreshCameras = useCallback(async () => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      setCameras(devices)
      return devices
    } catch {
      return []
    }
  }, [])

  const startScanner = useCallback(
    async (deviceId) => {
      if (scanningRef.current) return
      scanningRef.current = true

      setCameraError(null)
      setScanState('scanning')

      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()

        if (!videoRef.current) {
          throw new Error('Camera preview is not ready')
        }

        // undefined deviceId → rear camera via facingMode: 'environment' (required on mobile)
        const effectiveDeviceId = deviceId || undefined

        const controls = await reader.decodeFromVideoDevice(
          effectiveDeviceId,
          videoRef.current,
          (result) => {
            if (result) {
              void lookupBarcode(result.getText())
            }
          },
        )

        controlsRef.current = controls
        setIsScannerActive(true)
        setCameraStarted(true)

        const devices = await refreshCameras()
        if (deviceId) {
          setSelectedCameraId(deviceId)
        } else if (devices.length > 0) {
          const preferredDevice =
            devices.find((device) => /back|rear|environment/i.test(device.label)) ??
            devices[devices.length - 1] ??
            devices[0]
          if (preferredDevice) {
            setSelectedCameraId(preferredDevice.deviceId)
          }
        }
      } catch (err) {
        let message = 'Unable to access camera. Check browser permissions or choose another camera.'

        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            message = 'Camera permission denied. Allow camera access in your browser settings and try again.'
          } else if (err.name === 'NotFoundError') {
            message = 'No camera found on this device.'
          } else if (err.name === 'NotReadableError') {
            message = 'Camera is in use by another app. Close it and try again.'
          } else {
            message = err.message
          }
        }

        setCameraError(message)
        setScanState('idle')
        setCameraStarted(false)
        stopScanner()
      } finally {
        scanningRef.current = false
      }
    },
    [lookupBarcode, refreshCameras, stopScanner],
  )

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    setIsMobileDevice(mobile)

    // Desktop browsers allow auto-start; mobile (especially iOS) requires a user tap
    if (!mobile) {
      void startScanner(undefined)
    }

    return () => {
      stopScanner()
    }
    // Mount/unmount only — mobile must start camera from a button tap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    void startScanner(selectedCameraId || undefined)
  }

  function handleStartCamera() {
    initScanAudio()
    void startScanner(selectedCameraId || undefined)
  }

  function handleCameraChange(deviceId) {
    stopScanner()
    setSelectedCameraId(deviceId)
    void startScanner(deviceId)
  }

  async function setCompressedPreview(dataUrl) {
    setIsCompressingImage(true)
    setFormError(null)
    try {
      const compressed = await compressImageDataUrl(dataUrl)
      setImagePreview(compressed)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not process image')
    } finally {
      setIsCompressingImage(false)
    }
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      document.getElementById('scan-image-file')?.click()
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0)
    await setCompressedPreview(canvas.toDataURL('image/jpeg', 0.92))
  }

  async function handleImageFile(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsCompressingImage(true)
    setFormError(null)
    try {
      const compressed = await compressImageFile(file)
      setImagePreview(compressed)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not process image')
    } finally {
      setIsCompressingImage(false)
      event.target.value = ''
    }
  }

  async function handleUpdateProduct() {
    if (!product) return

    setFormError(null)
    setIsSaving(true)

    const barcode = form.barcode.trim()
    const name = form.name.trim() || `Product ${barcode}`

    let imageBase64 = imagePreview || undefined
    if (imageBase64) {
      try {
        imageBase64 = await compressImageDataUrl(imageBase64)
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Could not compress image')
        setIsSaving(false)
        return
      }
    }

    const payload = {
      sku: form.sku.trim() || barcode,
      barcode,
      name,
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      minimumStockLevel: Number(form.minimumStockLevel) || 0,
      imageBase64,
    }

    try {
      const response = await apiFetch(`/api/products/${product.id}/from-scan`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setProduct(response.data)
      setForm(productToForm(response.data))
      setImagePreview(null)
      setScanState('found')
      playScanBeep('created')
    } catch (err) {
      setFormError(formatApiError(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDisableProduct() {
    if (!product || !canDelete) return
    if (!confirm(`Disable product ${product.sku}?`)) return

    setFormError(null)
    setIsSaving(true)

    try {
      await apiFetch(`/api/products/${product.id}/disable`, { method: 'PATCH' })
      resetScan()
    } catch (err) {
      setFormError(formatApiError(err))
    } finally {
      setIsSaving(false)
    }
  }

  const showScanner = scanState === 'idle' || scanState === 'scanning' || scanState === 'error'
  const showProductForm = scanState === 'found' || scanState === 'not-found'
  const displayImage = imagePreview || product?.imageUrl

  async function handleCreateProduct() {
    setFormError(null)
    setIsSaving(true)

    const barcode = form.barcode.trim()
    const name = form.name.trim() || `Product ${barcode}`

    let imageBase64 = imagePreview || undefined
    if (imageBase64) {
      try {
        imageBase64 = await compressImageDataUrl(imageBase64)
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Could not compress image')
        setIsSaving(false)
        return
      }
    }

    const payload = {
      sku: form.sku.trim() || barcode,
      barcode,
      name,
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      minimumStockLevel: Number(form.minimumStockLevel) || 0,
      imageBase64,
    }

    try {
      const response = await apiFetch('/api/products/from-scan', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setProduct(response.data)
      setForm(productToForm(response.data))
      setImagePreview(null)
      setScanState('found')
      playScanBeep('created')
    } catch (err) {
      setFormError(formatApiError(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-gray-900 sm:text-2xl">Scan</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Scan a barcode with your camera. If the product exists, details will appear. Otherwise you
          can add it with a photo.
        </p>
      </div>

      <div
        className={
          showScanner
            ? 'flex flex-col-reverse gap-6 lg:grid lg:grid-cols-2'
            : 'space-y-4'
        }
      >
        {showScanner && (
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
                    onChange={(event) => handleCameraChange(event.target.value)}
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
                  autoPlay
                />
                {!cameraStarted && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-4">
                    <p className="text-center text-sm text-white/90">
                      {isMobileDevice
                        ? 'Tap below to allow camera access and start scanning.'
                        : 'Starting camera…'}
                    </p>
                    {isMobileDevice && (
                      <Button type="button" onClick={handleStartCamera}>
                        <Camera className="mr-2 h-4 w-4" />
                        Start camera
                      </Button>
                    )}
                  </div>
                )}
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
                {!cameraStarted && isMobileDevice && (
                  <Button type="button" onClick={handleStartCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    Start camera
                  </Button>
                )}
              </div>

              <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
                <Label htmlFor="manual-barcode">Manual barcode entry</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="manual-barcode"
                    placeholder="Type or paste barcode"
                    value={manualBarcode}
                    onChange={(event) => setManualBarcode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void lookupBarcode(manualBarcode)
                    }}
                  />
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => void lookupBarcode(manualBarcode)}
                    disabled={!manualBarcode.trim() || isLookingUp}
                  >
                    Look up
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div ref={resultRef} className="space-y-4 scroll-mt-4">
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

          {showScanner && scanState === 'idle' && !cameraError && !isMobileDevice && !cameraStarted && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-[var(--color-muted)]">
                Starting camera…
              </CardContent>
            </Card>
          )}

          {showScanner && scanState === 'idle' && !cameraError && isMobileDevice && !cameraStarted && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-[var(--color-muted)]">
                Tap &quot;Start camera&quot; to begin scanning.
              </CardContent>
            </Card>
          )}

          {showScanner && scanState === 'scanning' && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-[var(--color-muted)]">
                Point the camera at a barcode.
              </CardContent>
            </Card>
          )}

          {showProductForm && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      {scanState === 'found' ? 'Product found' : 'Product not found'}
                    </CardTitle>
                    <CardDescription>
                      {scanState === 'found'
                        ? `Barcode ${product?.barcode} — edit details below`
                        : `Barcode ${scannedBarcode} — add product details below`}
                    </CardDescription>
                  </div>
                  {product?.status && <StatusBadge status={product.status} />}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Product image</Label>
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={form.name || 'Product'}
                      className="max-h-48 w-full rounded-lg border border-[var(--color-border)] object-contain bg-gray-50"
                    />
                  ) : (
                    <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 text-sm text-[var(--color-muted)]">
                      No product image
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void capturePhoto()}
                      disabled={isCompressingImage}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {isCompressingImage ? 'Processing…' : 'Capture'}
                    </Button>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                      <input
                        id="scan-image-file"
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
                      placeholder={`Product ${form.barcode || 'name'}`}
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
                  {scanState === 'not-found' ? (
                    <Button
                      type="button"
                      onClick={() => void handleCreateProduct()}
                      disabled={!form.barcode.trim() || isSaving}
                    >
                      {isSaving ? 'Adding…' : 'Add product'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleUpdateProduct()}
                      disabled={!form.barcode.trim() || isSaving}
                    >
                      {isSaving ? 'Saving…' : 'Save changes'}
                    </Button>
                  )}
                  {scanState === 'found' && canDelete && product?.status === 'ACTIVE' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleDisableProduct()}
                      disabled={isSaving}
                      className="text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={resetScan}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Scan another
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
