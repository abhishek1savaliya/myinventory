// @ts-nocheck
const OCR_MAX_WIDTH = 640
const OCR_MAX_HEIGHT = 900
const FAST_OUTPUT = {
  text: true,
  blocks: false,
  layoutBlocks: false,
  hocr: false,
  tsv: false,
  box: false,
  unlv: false,
  osd: false,
  pdf: false,
  imageColor: false,
  imageGrey: false,
  imageBinary: false,
  debug: false,
}

let workerPromise = null
let progressCallback = null

function cleanLine(line) {
  return line.replace(/\s+/g, ' ').trim()
}

function isNoiseLine(line) {
  if (line.length < 2) return true
  if (/^[\d\s\-.$€£%]+$/.test(line)) return true
  if (/^\d{8,}$/.test(line.replace(/\s/g, ''))) return true
  if (/^(sku|barcode|upc|ean|mrp|price|rs\.?|usd|net\s*wt|ingredients)\b/i.test(line)) return true
  return false
}

function scoreTitle(line) {
  let score = Math.min(line.length, 80)
  if (/^[A-Z]/.test(line)) score += 5
  if (line.split(' ').length >= 2) score += 3
  return score
}

function pickTitleLine(lines) {
  const candidates = lines.slice(0, 5).filter((line) => line.length >= 3 && line.length <= 120)
  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) => scoreTitle(b) - scoreTitle(a))[0]?.slice(0, 255) ?? null
}

function findCategoryCandidate(lines, name) {
  const remaining = lines.filter((line) => line !== name)

  for (const line of remaining.slice(0, 6)) {
    if (line.length > 64 || line.split(' ').length > 6) continue
    if (/^(category|type|dept|department)\b/i.test(line)) continue
    return line.slice(0, 128)
  }

  return null
}

function buildDescriptionFromLines(lines, name, category) {
  const body = lines.filter((line) => line !== name && line !== category)
  if (body.length === 0) return null

  const description = body.join(' ').trim()
  return description.length >= 8 ? description.slice(0, 2000) : null
}

export function parseProductTextFromOcr(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => !isNoiseLine(line))

  const result = { name: null, category: null, description: null }

  const labelPatterns = {
    name: /^(?:product\s*name|item\s*name|name|title|product)\s*[:.\-]\s*(.+)$/i,
    category: /^(?:category|cat(?:egory)?|type|department|dept)\s*[:.\-]\s*(.+)$/i,
    description: /^(?:description|desc(?:ription)?|details|about)\s*[:.\-]\s*(.+)$/i,
  }

  for (const line of lines) {
    for (const [field, pattern] of Object.entries(labelPatterns)) {
      if (result[field]) continue
      const match = line.match(pattern)
      if (match?.[1]?.trim()) {
        result[field] = match[1].trim().slice(0, field === 'description' ? 2000 : field === 'category' ? 128 : 255)
      }
    }
  }

  const descriptionBlock = rawText.match(
    /(?:description|desc(?:ription)?|details|about)\s*[:.\-]\s*([\s\S]+?)(?:\n\s*\n|$)/i,
  )
  if (descriptionBlock?.[1] && !result.description) {
    const cleaned = descriptionBlock[1]
      .split(/\r?\n/)
      .map(cleanLine)
      .filter((line) => line && !isNoiseLine(line))
      .join(' ')
    if (cleaned) {
      result.description = cleaned.slice(0, 2000)
    }
  }

  if (!result.name) {
    result.name = pickTitleLine(lines)
  }

  if (!result.category) {
    result.category = findCategoryCandidate(lines, result.name)
  }

  if (!result.description) {
    result.description = buildDescriptionFromLines(lines, result.name, result.category)
  }

  return result
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image for OCR'))
    img.src = dataUrl
  })
}

async function prepareImageForOcr(imageDataUrl) {
  const img = await loadImage(imageDataUrl)
  const scale = Math.min(1, OCR_MAX_WIDTH / img.width, OCR_MAX_HEIGHT / img.height)
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Could not prepare image for OCR')
  }

  context.filter = 'grayscale(1) contrast(1.15)'
  context.drawImage(img, 0, 0, width, height)

  return canvas
}

async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM, PSM } = await import('tesseract.js')
      const worker = await createWorker('eng', OEM.LSTM_ONLY, {
        logger: (message) => {
          if (
            message.status === 'recognizing text' &&
            typeof message.progress === 'number' &&
            progressCallback
          ) {
            progressCallback(message.progress)
          }
        },
      })

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
      })

      return worker
    })()
  }

  return workerPromise
}

/** Warm up OCR worker and language data before the user uploads a photo. */
export function preloadProductPhotoOcr() {
  void getOcrWorker()
}

export async function extractProductDetailsFromImage(imageDataUrl, onProgress) {
  progressCallback = onProgress ?? null

  try {
    const [worker, ocrCanvas] = await Promise.all([
      getOcrWorker(),
      prepareImageForOcr(imageDataUrl),
    ])

    const { data } = await worker.recognize(ocrCanvas, { rotateAuto: false }, FAST_OUTPUT)

    return parseProductTextFromOcr(data.text)
  } finally {
    progressCallback = null
  }
}

export async function terminateProductPhotoOcr() {
  if (!workerPromise) return

  try {
    const worker = await workerPromise
    await worker.terminate()
  } catch {
    // ignore cleanup errors
  } finally {
    workerPromise = null
  }
}
