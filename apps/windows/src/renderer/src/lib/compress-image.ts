// @ts-nocheck
const DEFAULT_MAX_WIDTH = 1280
const DEFAULT_MAX_HEIGHT = 1280
/** Stay under API zod limit (3M chars) with headroom */
const DEFAULT_MAX_BASE64_LENGTH = 900_000

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Could not read image file'))
      }
    }
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = dataUrl
  })
}

function renderToCanvas(img, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not compress image')
  }
  ctx.drawImage(img, 0, 0, width, height)
  return canvas
}

function encodeUnderLimit(canvas, maxBase64Length) {
  let quality = 0.85
  let result = canvas.toDataURL('image/jpeg', quality)

  while (result.length > maxBase64Length && quality > 0.3) {
    quality -= 0.08
    result = canvas.toDataURL('image/jpeg', quality)
  }

  return result
}

/**
 * Compress a data URL for product upload (resize + JPEG quality).
 * @param {string} dataUrl
 * @param {{ maxWidth?: number, maxHeight?: number, maxBase64Length?: number }} [options]
 * @returns {Promise<string>}
 */
export async function compressImageDataUrl(dataUrl, options = {}) {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT
  const maxBase64Length = options.maxBase64Length ?? DEFAULT_MAX_BASE64_LENGTH

  const img = await loadImage(dataUrl)
  const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height)
  let width = Math.max(1, Math.round(img.width * scale))
  let height = Math.max(1, Math.round(img.height * scale))

  let canvas = renderToCanvas(img, width, height)
  let result = encodeUnderLimit(canvas, maxBase64Length)

  while (result.length > maxBase64Length && width > 480) {
    width = Math.round(width * 0.75)
    height = Math.round(height * 0.75)
    canvas = renderToCanvas(img, width, height)
    result = encodeUnderLimit(canvas, maxBase64Length)
  }

  if (result.length > maxBase64Length) {
    throw new Error('Image is still too large after compression. Try a smaller photo.')
  }

  return result
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function compressImageFile(file) {
  const dataUrl = await readFileAsDataUrl(file)
  return compressImageDataUrl(dataUrl)
}
