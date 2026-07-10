import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabase.js'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error-handler.js'

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/

let bucketEnsured = false

export async function ensureOrgBrandingBucket(): Promise<void> {
  if (bucketEnsured) {
    return
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const exists = buckets.some((bucket) => bucket.name === env.supabaseOrgBrandingBucket)
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(
      env.supabaseOrgBrandingBucket,
      { public: true },
    )
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw createError
    }
  }

  bucketEnsured = true
}

export async function uploadOrgBrandingImageFromBase64(
  organizationId: string,
  kind: 'logo' | 'background',
  imageBase64: string,
): Promise<string> {
  await ensureOrgBrandingBucket()

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
  const objectPath = `${organizationId}/${kind}-${randomUUID()}.${extension}`

  const { error } = await supabaseAdmin.storage
    .from(env.supabaseOrgBrandingBucket)
    .upload(objectPath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new AppError(500, `Failed to upload branding image: ${error.message}`)
  }

  const { data } = supabaseAdmin.storage.from(env.supabaseOrgBrandingBucket).getPublicUrl(objectPath)
  return data.publicUrl
}

export function extractOrgBrandingObjectPath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl)
    const marker = `/public/${env.supabaseOrgBrandingBucket}/`
    const index = url.pathname.indexOf(marker)
    if (index === -1) {
      return null
    }
    return decodeURIComponent(url.pathname.slice(index + marker.length))
  } catch {
    return null
  }
}

export async function deleteOrgBrandingFromUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    return
  }

  await ensureOrgBrandingBucket()

  const objectPaths = urls
    .map((url) => extractOrgBrandingObjectPath(url))
    .filter((path): path is string => path !== null)

  if (objectPaths.length === 0) {
    return
  }

  const { error } = await supabaseAdmin.storage.from(env.supabaseOrgBrandingBucket).remove(objectPaths)

  if (error) {
    console.error('[deleteOrgBrandingFromUrls] Failed to delete from storage:', error.message)
  }
}
