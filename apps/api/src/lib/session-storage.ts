import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabase.js'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error-handler.js'

export interface StoredSession {
  token: string
  userId: string
  expiresAt: string
}

let bucketEnsured = false

export async function ensureSessionBucket(): Promise<void> {
  if (bucketEnsured) {
    return
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const exists = buckets.some((bucket) => bucket.name === env.supabaseSessionsBucket)
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(env.supabaseSessionsBucket, {
      public: false,
    })
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw createError
    }
  }

  bucketEnsured = true
}

function sessionPath(sessionId: string): string {
  return `${sessionId}.json`
}

export async function saveSession(sessionId: string, session: StoredSession): Promise<void> {
  await ensureSessionBucket()

  const { error } = await supabaseAdmin.storage
    .from(env.supabaseSessionsBucket)
    .upload(sessionPath(sessionId), JSON.stringify(session), {
      contentType: 'application/json',
      upsert: true,
    })

  if (error) {
    throw new AppError(500, `Failed to save session: ${error.message}`)
  }
}

export async function loadSession(sessionId: string): Promise<StoredSession | null> {
  await ensureSessionBucket()

  const { data, error } = await supabaseAdmin.storage
    .from(env.supabaseSessionsBucket)
    .download(sessionPath(sessionId))

  if (error || !data) {
    return null
  }

  try {
    const parsed = JSON.parse(await data.text()) as StoredSession
    if (!parsed.token || !parsed.userId || !parsed.expiresAt) {
      return null
    }
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      await deleteSession(sessionId)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await ensureSessionBucket()

  await supabaseAdmin.storage.from(env.supabaseSessionsBucket).remove([sessionPath(sessionId)])
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
