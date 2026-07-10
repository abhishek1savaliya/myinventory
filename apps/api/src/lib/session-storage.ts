import { randomUUID } from 'node:crypto'
import { redis } from './redis.js'

export interface StoredSession {
  token: string
  userId: string
  expiresAt: string
}
const SESSION_KEY_PREFIX = 'myinventory:session'

function sessionKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}:${sessionId}`
}

function sessionTtlSeconds(expiresAt: string): number {
  const seconds = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  return Math.max(60, Math.min(seconds, 60 * 60 * 24 * 30))
}

function isSessionExpired(session: StoredSession): boolean {
  return new Date(session.expiresAt).getTime() <= Date.now()
}

export async function ensureSessionBucket(): Promise<void> {
  // Sessions are stored in Redis. Kept for startup compatibility.
}

export async function saveSession(sessionId: string, session: StoredSession): Promise<void> {
  await redis.set(sessionKey(sessionId), session, {
    ex: sessionTtlSeconds(session.expiresAt),
  })
}

export async function loadSession(sessionId: string): Promise<StoredSession | null> {
  const session = await redis.get<StoredSession>(sessionKey(sessionId))

  if (!session?.token || !session.userId || !session.expiresAt) {
    return null
  }

  if (isSessionExpired(session)) {
    await deleteSession(sessionId)
    return null
  }

  return session
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(sessionKey(sessionId))
}

export function createSessionId(): string {
  return randomUUID()
}

export function sessionExpiresAt(hours = 8): string {
  const expires = new Date()
  expires.setHours(expires.getHours() + hours)
  return expires.toISOString()
}

export function parseSessionDurationHours(duration: string): number {
  const match = /^(\d+)([hms])$/i.exec(duration.trim())
  if (!match) return 8

  const value = Number(match[1])
  const unit = match[2].toLowerCase()

  if (unit === 'h') return value
  if (unit === 'm') return value / 60
  return value / 3600
}
