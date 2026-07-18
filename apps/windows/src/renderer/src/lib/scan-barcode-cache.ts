// @ts-nocheck
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map()

export function getCachedBarcodeLookup(barcode) {
  const entry = cache.get(barcode)
  if (!entry) return null
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(barcode)
    return null
  }
  return entry.value
}

export function setCachedBarcodeLookup(barcode, value) {
  cache.set(barcode, { at: Date.now(), value })
}

export function clearCachedBarcodeLookup(barcode) {
  cache.delete(barcode.trim())
}
