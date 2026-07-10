import { redis } from './redis.js'
import { env } from '../config/env.js'

const KEY_PREFIX = 'myinventory'
const VERSION_CACHE_MS = 5_000
const versionCache = new Map<string, { version: number; expiresAt: number }>()

async function getNamespaceVersion(namespace: string): Promise<number> {
  const cached = versionCache.get(namespace)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.version
  }

  const version = (await redis.get<number>(`${KEY_PREFIX}:${namespace}:v`)) ?? 0
  versionCache.set(namespace, { version, expiresAt: Date.now() + VERSION_CACHE_MS })
  return version
}

function buildCacheKey(namespace: string, version: number, suffix: string): string {
  return `${KEY_PREFIX}:${namespace}:v${version}:${suffix}`
}

export async function cacheGetOrSet<T>(
  namespace: string,
  suffix: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const version = await getNamespaceVersion(namespace)
  const key = buildCacheKey(namespace, version, suffix)

  const cached = await redis.get<T>(key)
  if (cached !== null && cached !== undefined) {
    return cached
  }

  const value = await loader()

  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch (error: unknown) {
    console.error(`[MyInventory API] Failed to write cache key ${key}`)
    if (error instanceof Error) {
      console.error(error.message)
    }
  }

  return value
}

export async function cacheDeleteSuffix(namespace: string, suffix: string): Promise<void> {
  const version = await getNamespaceVersion(namespace)
  await redis.del(buildCacheKey(namespace, version, suffix))
}

export async function invalidateCache(namespace: string): Promise<void> {
  versionCache.delete(namespace)
  await redis.incr(`${KEY_PREFIX}:${namespace}:v`)
}

export function stableCacheSuffix(label: string, params: unknown): string {
  return `${label}:${JSON.stringify(params)}`
}

export const cacheTtl = {
  catalog: env.cacheTtlCatalogSeconds,
  inventory: env.cacheTtlInventorySeconds,
  scan: env.cacheTtlScanBarcodeSeconds,
} as const
