import type { AppFeature, UserRole } from '@myinventory/shared'
import { redis } from './redis.js'

const KEY_PREFIX = 'myinventory:user:auth'
const AUTH_CACHE_TTL_SECONDS = 60

export interface CachedUserAuth {
  status: string
  organizationId: string
  role: UserRole
  extraFeatures: AppFeature[]
}

function buildKey(userId: string): string {
  return `${KEY_PREFIX}:${userId}`
}

export async function getCachedUserAuth(userId: string): Promise<CachedUserAuth | null> {
  return redis.get<CachedUserAuth>(buildKey(userId))
}

export async function setCachedUserAuth(userId: string, value: CachedUserAuth): Promise<void> {
  await redis.set(buildKey(userId), value, { ex: AUTH_CACHE_TTL_SECONDS })
}

export async function invalidateUserAuthCache(userId: string): Promise<void> {
  await redis.del(buildKey(userId))
}
