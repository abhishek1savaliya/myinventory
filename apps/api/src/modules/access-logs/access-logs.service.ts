import { supabaseAdmin } from '../../lib/supabase.js'
import { env } from '../../config/env.js'

export interface RecordAccessLogInput {
  method: string
  path: string
  statusCode: number
  durationMs: number
  userId?: string | null
  userEmail?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

interface ApiLogEntry {
  timestamp: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  userId: string | null
  userEmail: string | null
  ipAddress: string | null
  userAgent: string | null
}

const FLUSH_DELAY_MS = 5_000

const bufferByDate = new Map<string, string[]>()
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>()
const flushPromises = new Map<string, Promise<void>>()

function getDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function getStoragePath(dateKey: string): string {
  return `${dateKey}.jsonl`
}

function toLogLine(entry: ApiLogEntry): string {
  return `${JSON.stringify(entry)}\n`
}

function scheduleFlush(dateKey: string): void {
  const existingTimer = flushTimers.get(dateKey)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  flushTimers.set(
    dateKey,
    setTimeout(() => {
      flushTimers.delete(dateKey)
      void flushDate(dateKey).catch((error: unknown) => {
        console.error(`[MyInventory API] Failed to flush access logs for ${dateKey}`)
        if (error instanceof Error) {
          console.error(error.message)
        }
      })
    }, FLUSH_DELAY_MS),
  )
}

async function downloadExistingContent(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(env.supabaseLogsBucket)
    .download(storagePath)

  if (error) {
    if (error.message.toLowerCase().includes('not found')) {
      return ''
    }
    throw error
  }

  return data.text()
}

async function uploadContent(storagePath: string, content: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(env.supabaseLogsBucket)
    .upload(storagePath, content, {
      upsert: true,
      contentType: 'application/x-ndjson',
    })

  if (error) {
    throw error
  }
}

async function flushDate(dateKey: string): Promise<void> {
  const inFlight = flushPromises.get(dateKey)
  if (inFlight) {
    await inFlight
    return
  }

  const flushPromise = (async () => {
    const lines = bufferByDate.get(dateKey)
    if (!lines?.length) {
      return
    }

    bufferByDate.set(dateKey, [])
    const newContent = lines.join('')
    const storagePath = getStoragePath(dateKey)

    const existingContent = await downloadExistingContent(storagePath)
    await uploadContent(storagePath, existingContent + newContent)
  })()

  flushPromises.set(dateKey, flushPromise)

  try {
    await flushPromise
  } finally {
    flushPromises.delete(dateKey)
  }
}

export async function recordAccessLog(input: RecordAccessLogInput): Promise<void> {
  const dateKey = getDateKey()
  const entry: ApiLogEntry = {
    timestamp: new Date().toISOString(),
    method: input.method,
    path: input.path,
    statusCode: input.statusCode,
    durationMs: input.durationMs,
    userId: input.userId ?? null,
    userEmail: input.userEmail ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  }

  if (!bufferByDate.has(dateKey)) {
    bufferByDate.set(dateKey, [])
  }

  bufferByDate.get(dateKey)!.push(toLogLine(entry))
  scheduleFlush(dateKey)
}

export async function flushAllAccessLogs(): Promise<void> {
  for (const timer of flushTimers.values()) {
    clearTimeout(timer)
  }
  flushTimers.clear()

  const dateKeys = [...bufferByDate.keys()]
  await Promise.all(dateKeys.map((dateKey) => flushDate(dateKey)))
}

let bucketEnsured = false

export async function ensureAccessLogBucket(): Promise<void> {
  if (bucketEnsured) {
    return
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const exists = buckets.some((bucket) => bucket.name === env.supabaseLogsBucket)
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(env.supabaseLogsBucket, {
      public: false,
    })
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw createError
    }
  }

  bucketEnsured = true
}
