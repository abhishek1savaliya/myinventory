import { randomUUID } from 'node:crypto'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error-handler.js'
import { supabaseAdmin } from './supabase.js'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024
let bucketEnsured = false

export async function ensureProfilePhotosBucket(): Promise<void> {
  if (bucketEnsured) return

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) throw listError

  if (!buckets.some((bucket) => bucket.name === env.supabaseProfilePhotosBucket)) {
    const { error } = await supabaseAdmin.storage.createBucket(env.supabaseProfilePhotosBucket, {
      public: true,
      fileSizeLimit: MAX_PROFILE_PHOTO_BYTES,
      allowedMimeTypes: [...ALLOWED_TYPES],
    })
    if (error && !error.message.toLowerCase().includes('already exists')) throw error
  }

  bucketEnsured = true
}

export async function uploadProfilePhoto(
  organizationId: string,
  userId: string,
  file: Express.Multer.File,
): Promise<string> {
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    throw new AppError(400, 'Profile photo must be a JPEG, PNG, or WebP image')
  }
  if (!file.buffer.length || file.buffer.length > MAX_PROFILE_PHOTO_BYTES) {
    throw new AppError(400, 'Profile photo must be 3 MB or smaller')
  }

  await ensureProfilePhotosBucket()
  const extension = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
  const objectPath = `${organizationId}/${userId}-${randomUUID()}.${extension}`
  const { error } = await supabaseAdmin.storage
    .from(env.supabaseProfilePhotosBucket)
    .upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: false })

  if (error) throw new AppError(500, `Failed to upload profile photo: ${error.message}`)
  return supabaseAdmin.storage.from(env.supabaseProfilePhotosBucket).getPublicUrl(objectPath).data.publicUrl
}

export async function deleteProfilePhoto(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return
  try {
    const url = new URL(publicUrl)
    const marker = `/public/${env.supabaseProfilePhotosBucket}/`
    const index = url.pathname.indexOf(marker)
    if (index === -1) return
    const objectPath = decodeURIComponent(url.pathname.slice(index + marker.length))
    await supabaseAdmin.storage.from(env.supabaseProfilePhotosBucket).remove([objectPath])
  } catch {
    // A failed cleanup must not undo a successful profile update.
  }
}
