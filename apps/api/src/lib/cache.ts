import { redis } from './redis.js'
import { env } from '../config/env.js'

const KEY_PREFIX = 'myinventory'

async function getNamespaceVersion(namespace: string): Promise<number> {
  const version = await redis.get<number>(`${KEY_PREFIX}:${namespace}:v`)
  return version ?? 0
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
  void redis.set(key, value, { ex: ttlSeconds }).catch((error: unknown) => {
    console.error(`[MyInventory API] Failed to write cache key ${key}`)
    if (error instanceof Error) {
      console.error(error.message)
    }
  })

  return value
}

export async function invalidateCache(namespace: string): Promise<void> {
  await redis.incr(`${KEY_PREFIX}:${namespace}:v`)
}

export function stableCacheSuffix(label: string, params: unknown): string {
  return `${label}:${JSON.stringify(params)}`
}

export const cacheTtl = {
  catalog: env.cacheTtlCatalogSeconds,
  inventory: env.cacheTtlInventorySeconds,
} as const
