// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

const CROP_SIZE = 240
const OUTPUT_SIZE = 512

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function ProfilePhotoCropDialog({
  imageUrl,
  busy,
  onCancel,
  onConfirm,
  title = 'Adjust profile photo',
}) {
  const imageRef = useRef(null)
  const dragRef = useRef(null)
  const [imageSize, setImageSize] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    setImageSize(null)
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }, [imageUrl])

  if (!imageUrl) return null

  const baseScale = imageSize
    ? Math.max(CROP_SIZE / imageSize.width, CROP_SIZE / imageSize.height)
    : 1
  const scale = baseScale * zoom
  const displayWidth = imageSize ? imageSize.width * scale : CROP_SIZE
  const displayHeight = imageSize ? imageSize.height * scale : CROP_SIZE
  const maxX = Math.max(0, (displayWidth - CROP_SIZE) / 2)
  const maxY = Math.max(0, (displayHeight - CROP_SIZE) / 2)

  function updateZoom(nextZoom) {
    const value = clamp(Number(nextZoom), 1, 3)
    const nextScale = baseScale * value
    const nextMaxX = Math.max(0, ((imageSize?.width ?? CROP_SIZE) * nextScale - CROP_SIZE) / 2)
    const nextMaxY = Math.max(0, ((imageSize?.height ?? CROP_SIZE) * nextScale - CROP_SIZE) / 2)
    setZoom(value)
    setPosition((current) => ({
      x: clamp(current.x, -nextMaxX, nextMaxX),
      y: clamp(current.y, -nextMaxY, nextMaxY),
    }))
  }

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      position,
    }
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return
    setPosition({
      x: clamp(
        dragRef.current.position.x + event.clientX - dragRef.current.startX,
        -maxX,
        maxX,
      ),
      y: clamp(
        dragRef.current.position.y + event.clientY - dragRef.current.startY,
        -maxY,
        maxY,
      ),
    })
  }

  async function handleConfirm() {
    const image = imageRef.current
    if (!image || !imageSize) return

    const sourceSize = CROP_SIZE / scale
    const sourceX = (imageSize.width - sourceSize) / 2 - position.x / scale
    const sourceY = (imageSize.height - sourceSize) / 2 - position.y / scale
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    )

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (blob) await onConfirm(blob)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Drag the photo to reposition it, then zoom in or out.
        </p>

        <div
          className="relative mx-auto mt-5 touch-none cursor-move overflow-hidden rounded-full bg-gray-100 ring-4 ring-white shadow-inner"
          style={{ width: CROP_SIZE, height: CROP_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { dragRef.current = null }}
          onPointerCancel={() => { dragRef.current = null }}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Crop preview"
            draggable={false}
            onLoad={(event) => {
              setImageSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              width: displayWidth,
              height: displayHeight,
              transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
            }}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Minus className="h-4 w-4 text-gray-500" aria-hidden />
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => updateZoom(event.target.value)}
            className="h-2 flex-1 cursor-pointer accent-[var(--color-primary)]"
            aria-label="Photo zoom"
          />
          <Plus className="h-4 w-4 text-gray-500" aria-hidden />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy || !imageSize}>
            {busy ? 'Uploading…' : 'Crop and upload'}
          </Button>
        </div>
      </div>
    </div>
  )
}
