import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabase.js'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error-handler.js'

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/

let bucketEnsured = false

export async function ensureProductImagesBucket(): Promise<void> {
  if (bucketEnsured) {
    return
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const exists = buckets.some((bucket) => bucket.name === env.supabaseProductsBucket)
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(
      env.supabaseProductsBucket,
      { public: true },
    )
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw createError
    }
  }

  bucketEnsured = true
}

export async function uploadProductImageFromBase64(imageBase64: string): Promise<string> {
  await ensureProductImagesBucket()

  const match = DATA_URL_PATTERN.exec(imageBase64)
  if (!match) {
    throw new AppError(400, 'Invalid image format. Use JPEG, PNG, or WebP.')
  }

  const mimeType = match[1]
  const base64Data = match[2]
  const buffer = Buffer.from(base64Data, 'base64')

  if (buffer.length === 0) {
    throw new AppError(400, 'Image data is empty')
  }

  if (buffer.length > 2 * 1024 * 1024) {
    throw new AppError(400, 'Image must be 2 MB or smaller')
  }

  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const objectPath = `${randomUUID()}.${extension}`

  const { error } = await supabaseAdmin.storage
    .from(env.supabaseProductsBucket)
    .upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new AppError(500, `Failed to upload product image: ${error.message}`)
  }

  const { data } = supabaseAdmin.storage.from(env.supabaseProductsBucket).getPublicUrl(objectPath)
  return data.publicUrl
}
