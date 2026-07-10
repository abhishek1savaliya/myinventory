'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Flashlight, ImagePlus, RotateCcw, ScanLine, Trash2, X } from 'lucide-react'
import { AppFeature, MAX_PRODUCT_IMAGES, UserRole } from '@myinventory/shared'
import { apiFetch, apiFetchJsonWithProgress, ApiRequestError, API_BASE_URL } from '@/lib/api-client'
import { useAuth } from '@/contexts/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { ImageCarousel } from '@/components/ui/image-carousel'

import { initScanAudio, playScanBeep } from '@/lib/scan-sound'
import { compressImageDataUrl, compressImageFile } from '@/lib/compress-image'
import {
  clearCachedBarcodeLookup,
  getCachedBarcodeLookup,
  setCachedBarcodeLookup,
} from '@/lib/scan-barcode-cache'
import {
  applyTorch,
  getStoredTorchPreference,
  setStoredTorchPreference,
  syncTorchWithPreference,
} from '@/lib/scan-torch'

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
  if (lastScanRef.current.barcode === barcode && now - lastScanRef.current.at < 1200) {
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
  const lookupInFlightRef = useRef(false)
  const zxingRef = useRef(null)
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
  const [pendingImages, setPendingImages] = useState([])
  const [removedImageIds, setRemovedImageIds] = useState([])
  const [formError, setFormError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState(null)
  const [isCompressingImage, setIsCompressingImage] = useState(false)
  const [torchOn, setTorchOn] = useState(() =>
    typeof window !== 'undefined' ? getStoredTorchPreference() : false,
  )
  const [torchSupported, setTorchSupported] = useState(false)

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null

    const video = videoRef.current
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }

    setIsScannerActive(false)
    setTorchSupported(false)
    setTorchOn(false)
  }, [])

  const refreshTorchState = useCallback(async () => {
    const video = videoRef.current
    if (!video || !isMobileDevice) {
      setTorchSupported(false)
      return
    }

    await new Promise((resolve) => requestAnimationFrame(resolve))
    const { supported, active } = await syncTorchWithPreference(video)
    setTorchSupported(supported)
    setTorchOn(active)
  }, [isMobileDevice])

  async function handleTorchToggle() {
    const video = videoRef.current
    if (!video || !torchSupported) return

    const next = !torchOn
    const applied = await applyTorch(video, next)
    if (!applied) return

    setTorchOn(next)
    setStoredTorchPreference(next)
  }

  const loadZxing = useCallback(async () => {
    if (zxingRef.current) {
      return zxingRef.current
    }

    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ])

    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
    ])

    zxingRef.current = { BrowserMultiFormatReader, hints }
    return zxingRef.current
  }, [])

  const lookupBarcode = useCallback(
    async (barcode) => {
      const trimmed = barcode.trim()
      if (!trimmed || !shouldProcessScan(trimmed, lastScanRef) || lookupInFlightRef.current) {
        return
      }

      lookupInFlightRef.current = true
      playScanBeep('scanned')
      stopScanner()
      setScannedBarcode(trimmed)
      setLookupError(null)
      setProduct(null)
      setIsLookingUp(true)
      setScanState('looking-up')

      const finishLookup = () => {
        lookupInFlightRef.current = false
        setIsLookingUp(false)
        requestAnimationFrame(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      }

      const applyFound = (data) => {
        setProduct(data)
        setForm(productToForm(data))
        setPendingImages([])
        setRemovedImageIds([])
        setScanState('found')
      }

      const applyNotFound = () => {
        setForm({
          ...emptyForm,
          barcode: trimmed,
          sku: trimmed,
          name: `Product ${trimmed}`,
        })
        setPendingImages([])
        setRemovedImageIds([])
        setFormError(null)
        setScanState('not-found')
      }

      const cached = getCachedBarcodeLookup(trimmed)
      if (cached) {
        if (cached.type === 'found') {
          applyFound(cached.product)
        } else {
          applyNotFound()
        }
        finishLookup()
        return
      }

      try {
        const response = await apiFetch(`/api/products/barcode/${encodeURIComponent(trimmed)}`)
        setCachedBarcodeLookup(trimmed, { type: 'found', product: response.data })
        applyFound(response.data)
      } catch (err) {
        if (err instanceof ApiRequestError && err.statusCode === 404) {
          setCachedBarcodeLookup(trimmed, { type: 'not-found' })
          applyNotFound()
        } else {
          setLookupError(formatApiError(err))
          setScanState('error')
        }
      } finally {
        finishLookup()
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
        const { BrowserMultiFormatReader, hints } = await loadZxing()
        const reader = new BrowserMultiFormatReader(hints)

        if (!videoRef.current) {
          throw new Error('Camera preview is not ready')
        }

        const onDecode = (result) => {
          if (result) {
            void lookupBarcode(result.getText())
          }
        }

        const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
        const videoConstraints = mobile
          ? {
              facingMode: { ideal: 'environment' },
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 },
            }
          : { width: { ideal: 1280 }, height: { ideal: 720 } }

        let controls
        if (deviceId) {
          controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current, onDecode)
        } else {
          controls = await reader.decodeFromConstraints(
            { video: videoConstraints },
            videoRef.current,
            onDecode,
          )
        }

        controlsRef.current = controls
        setIsScannerActive(true)
        setCameraStarted(true)

        if (mobile) {
          await refreshTorchState()
        }

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
    [lookupBarcode, refreshCameras, refreshTorchState, stopScanner, loadZxing],
  )

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    setIsMobileDevice(mobile)

    void loadZxing()

    if (API_BASE_URL) {
      try {
        const origin = new URL(API_BASE_URL).origin
        const link = document.createElement('link')
        link.rel = 'preconnect'
        link.href = origin
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
      } catch {
        // ignore invalid API URL
      }
    }

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
    setPendingImages([])
    setRemovedImageIds([])
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

  const savedImages = (product?.images ?? []).filter((image) => !removedImageIds.includes(image.id))
  const totalImages = savedImages.length + pendingImages.length
  const canAddMoreImages = totalImages < MAX_PRODUCT_IMAGES
  const displayPhotos = [
    ...savedImages.map((image) => ({
      key: image.id,
      url: image.url,
      type: 'saved',
      imageId: image.id,
    })),
    ...pendingImages.map((image, index) => ({
      key: `pending-${index}`,
      url: image,
      type: 'pending',
      pendingIndex: index,
    })),
  ]

  function removeDisplayPhoto(photo) {
    if (photo.type === 'saved') {
      setRemovedImageIds((prev) => [...prev, photo.imageId])
      return
    }

    setPendingImages((prev) => prev.filter((_, itemIndex) => itemIndex !== photo.pendingIndex))
  }

  async function addPendingImage(dataUrl) {
    if (!canAddMoreImages) {
      setFormError(`Maximum ${MAX_PRODUCT_IMAGES} photos per product`)
      return
    }

    setIsCompressingImage(true)
    setFormError(null)
    try {
      const compressed = await compressImageDataUrl(dataUrl)
      setPendingImages((prev) => [...prev, compressed])
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not process image')
    } finally {
      setIsCompressingImage(false)
    }
  }

  async function capturePhoto() {
    if (!canAddMoreImages) {
      setFormError(`Maximum ${MAX_PRODUCT_IMAGES} photos per product`)
      return
    }

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
    await addPendingImage(canvas.toDataURL('image/jpeg', 0.92))
  }

  async function handleImageFile(event) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    setIsCompressingImage(true)
    setFormError(null)

    try {
      const nextImages = [...pendingImages]
      let remainingSlots = MAX_PRODUCT_IMAGES - savedImages.length - nextImages.length

      for (const file of files) {
        if (remainingSlots <= 0) {
          setFormError(`Maximum ${MAX_PRODUCT_IMAGES} photos per product`)
          break
        }

        const compressed = await compressImageFile(file)
        nextImages.push(compressed)
        remainingSlots -= 1
      }

      setPendingImages(nextImages)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not process image')
    } finally {
      setIsCompressingImage(false)
      event.target.value = ''
    }
  }

  const COMPRESS_PROGRESS_MAX = 35
  const UPLOAD_PROGRESS_MAX = 92

  async function buildImagesPayload(onProgress) {
    if (pendingImages.length === 0) {
      return undefined
    }

    const compressedImages = []
    const total = pendingImages.length

    for (let index = 0; index < pendingImages.length; index += 1) {
      compressedImages.push(await compressImageDataUrl(pendingImages[index]))
      onProgress?.(Math.round(((index + 1) / total) * COMPRESS_PROGRESS_MAX))
    }

    return compressedImages
  }

  async function saveProductFromScan({ path, method, includeRemovedImages = false }) {
    const hasNewImages = pendingImages.length > 0

    setFormError(null)
    setIsSaving(true)
    setSaveProgress(hasNewImages ? 0 : null)

    const barcode = form.barcode.trim()
    const name = form.name.trim() || `Product ${barcode}`

    let imagesBase64
    try {
      imagesBase64 = await buildImagesPayload(
        hasNewImages ? (percent) => setSaveProgress(percent) : undefined,
      )
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not compress image')
      setIsSaving(false)
      setSaveProgress(null)
      return
    }

    const payload = {
      sku: form.sku.trim() || barcode,
      barcode,
      name,
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      minimumStockLevel: Number(form.minimumStockLevel) || 0,
      ...(imagesBase64?.length ? { imagesBase64 } : {}),
      ...(includeRemovedImages && removedImageIds.length ? { removeImageIds: removedImageIds } : {}),
    }

    const body = JSON.stringify(payload)

    try {
      const response = hasNewImages
        ? await apiFetchJsonWithProgress(
            path,
            { method, body },
            (loaded, total) => {
              if (total <= 0) return
              const uploadPercent =
                COMPRESS_PROGRESS_MAX +
                Math.round((loaded / total) * (UPLOAD_PROGRESS_MAX - COMPRESS_PROGRESS_MAX))
              setSaveProgress(Math.min(uploadPercent, UPLOAD_PROGRESS_MAX))
            },
          )
        : await apiFetch(path, { method, body })

      if (hasNewImages) {
        setSaveProgress(95)
      }

      setProduct(response.data)
      setForm(productToForm(response.data))
      setPendingImages([])
      setRemovedImageIds([])
      clearCachedBarcodeLookup(barcode)
      setCachedBarcodeLookup(barcode, { type: 'found', product: response.data })
      setScanState('found')
      playScanBeep('created')

      if (hasNewImages) {
        setSaveProgress(100)
      }
    } catch (err) {
      setFormError(formatApiError(err))
    } finally {
      setIsSaving(false)
      setSaveProgress(null)
    }
  }

  async function handleUpdateProduct() {
    if (!product) return

    await saveProductFromScan({
      path: `/api/products/${product.id}/from-scan`,
      method: 'PUT',
      includeRemovedImages: true,
    })
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

  async function handleCreateProduct() {
    await saveProductFromScan({
      path: '/api/products/from-scan',
      method: 'POST',
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-gray-900 sm:text-2xl">Scan</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Scan a barcode with your camera. If the product exists, details will appear. Otherwise you
          can add it with up to {MAX_PRODUCT_IMAGES} photos.
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
                {isMobileDevice && cameraStarted && torchSupported && isScannerActive && (
                  <button
                    type="button"
                    onClick={() => void handleTorchToggle()}
                    className={`absolute bottom-3 right-3 rounded-full p-3 shadow-lg transition-colors ${
                      torchOn ? 'bg-amber-400 text-amber-950' : 'bg-black/60 text-white'
                    }`}
                    aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                    aria-pressed={torchOn}
                  >
                    <Flashlight className="h-5 w-5" />
                  </button>
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
                {isMobileDevice && cameraStarted && torchSupported && isScannerActive && (
                  <Button
                    type="button"
                    variant={torchOn ? 'default' : 'outline'}
                    onClick={() => void handleTorchToggle()}
                  >
                    <Flashlight className="mr-2 h-4 w-4" />
                    {torchOn ? 'Flashlight on' : 'Flashlight off'}
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
                  <div className="flex items-center justify-between gap-2">
                    <Label>Product photos</Label>
                    <span className="text-xs text-[var(--color-muted)]">
                      {totalImages}/{MAX_PRODUCT_IMAGES}
                    </span>
                  </div>
                  {totalImages === 0 ? (
                    <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-gray-50 text-sm text-[var(--color-muted)]">
                      No photos yet
                    </div>
                  ) : (
                    <ImageCarousel
                      images={displayPhotos}
                      alt={form.name || 'Product'}
                      renderSlideOverlay={(slide) => {
                        const photo = displayPhotos.find((item) => item.key === slide.key)
                        if (!photo) return null

                        return (
                          <button
                            type="button"
                            onClick={() => removeDisplayPhoto(photo)}
                            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                            aria-label="Remove photo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )
                      }}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void capturePhoto()}
                      disabled={isCompressingImage || !canAddMoreImages}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {isCompressingImage ? 'Processing…' : 'Capture'}
                    </Button>
                    <label
                      className={`inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50 ${
                        isCompressingImage || !canAddMoreImages
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer'
                      }`}
                    >
                      <input
                        id="scan-image-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        multiple
                        disabled={isCompressingImage || !canAddMoreImages}
                        onChange={handleImageFile}
                      />
                      <ImagePlus className="h-4 w-4" />
                      Upload
                    </label>
                  </div>
                  {!canAddMoreImages && (
                    <p className="text-xs text-[var(--color-muted)]">
                      Maximum {MAX_PRODUCT_IMAGES} photos reached. Remove a photo to add another.
                    </p>
                  )}
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

                {isSaving && saveProgress !== null && (
                  <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900">
                        {scanState === 'not-found' ? 'Adding product' : 'Saving product'}
                      </span>
                      <span className="tabular-nums text-[var(--color-muted)]">{saveProgress}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-gray-200"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={saveProgress}
                      aria-label="Product save progress"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--color-primary,#2563eb)] transition-[width] duration-200 ease-out"
                        style={{ width: `${saveProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">
                      {saveProgress < COMPRESS_PROGRESS_MAX
                        ? 'Preparing photos…'
                        : saveProgress < UPLOAD_PROGRESS_MAX
                          ? 'Uploading photos…'
                          : 'Finishing up…'}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {scanState === 'not-found' ? (
                    <Button
                      type="button"
                      onClick={() => void handleCreateProduct()}
                      disabled={!form.barcode.trim() || isSaving}
                    >
                      {isSaving
                        ? saveProgress !== null
                          ? `Adding… ${saveProgress}%`
                          : 'Adding…'
                        : 'Add product'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleUpdateProduct()}
                      disabled={!form.barcode.trim() || isSaving}
                    >
                      {isSaving
                        ? saveProgress !== null
                          ? `Saving… ${saveProgress}%`
                          : 'Saving…'
                        : 'Save changes'}
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
