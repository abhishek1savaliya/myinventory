import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabase.js'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error-handler.js'
import {
  CHAT_MAX_FILE_BYTES,
  CHAT_MAX_IMAGE_BYTES,
  CHAT_MAX_VIDEO_BYTES,
  ChatAttachmentType,
} from '@myinventory/shared'

let bucketEnsured = false

export function classifyChatAttachmentType(mimeType: string): ChatAttachmentType {
  if (mimeType.startsWith('image/')) {
    return ChatAttachmentType.IMAGE
  }

  if (mimeType.startsWith('video/')) {
    return ChatAttachmentType.VIDEO
  }

  return ChatAttachmentType.FILE
}

export function getMaxChatAttachmentBytes(type: ChatAttachmentType): number {
  switch (type) {
    case ChatAttachmentType.IMAGE:
      return CHAT_MAX_IMAGE_BYTES
    case ChatAttachmentType.VIDEO:
      return CHAT_MAX_VIDEO_BYTES
    default:
      return CHAT_MAX_FILE_BYTES
  }
}

function sanitizeFileName(fileName: string): string {
  const base = fileName.replace(/[^\w.\-()+\s]/g, '_').trim()
  return base.length > 0 ? base.slice(0, 180) : 'attachment'
}

function extensionFromMimeType(mimeType: string, fileName: string): string {
  const fromName = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : null
  if (fromName && fromName.length <= 8) {
    return fromName
  }

  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType.startsWith('image/')) return 'jpg'
  if (mimeType === 'video/webm') return 'webm'
  if (mimeType.startsWith('video/')) return 'mp4'
  if (mimeType === 'application/pdf') return 'pdf'
  return 'bin'
}

export async function ensureChatAttachmentsBucket(): Promise<void> {
  if (bucketEnsured) {
    return
  }

  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const exists = buckets.some((bucket) => bucket.name === env.supabaseChatAttachmentsBucket)
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(
      env.supabaseChatAttachmentsBucket,
      { public: true },
    )
    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw createError
    }
  }

  bucketEnsured = true
}

export async function uploadChatAttachment(input: {
  organizationId: string
  buffer: Buffer
  mimeType: string
  fileName: string
}): Promise<{ url: string; type: ChatAttachmentType; size: number }> {
  await ensureChatAttachmentsBucket()

  const mimeType = input.mimeType || 'application/octet-stream'
  const attachmentType = classifyChatAttachmentType(mimeType)
  const maxBytes = getMaxChatAttachmentBytes(attachmentType)

  if (input.buffer.length === 0) {
    throw new AppError(400, 'File is empty')
  }

  if (input.buffer.length > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024))
    const label =
      attachmentType === ChatAttachmentType.IMAGE
        ? 'Image'
        : attachmentType === ChatAttachmentType.VIDEO
          ? 'Video'
          : 'File'
    throw new AppError(400, `${label} must be ${limitMb} MB or smaller`)
  }

  const safeName = sanitizeFileName(input.fileName)
  const extension = extensionFromMimeType(mimeType, safeName)
  const objectPath = `${input.organizationId}/${randomUUID()}.${extension}`

  const { error } = await supabaseAdmin.storage
    .from(env.supabaseChatAttachmentsBucket)
    .upload(objectPath, input.buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (error) {
    throw new AppError(500, `Failed to upload chat attachment: ${error.message}`)
  }

  const { data } = supabaseAdmin.storage
    .from(env.supabaseChatAttachmentsBucket)
    .getPublicUrl(objectPath)

  return {
    url: data.publicUrl,
    type: attachmentType,
    size: input.buffer.length,
  }
}
