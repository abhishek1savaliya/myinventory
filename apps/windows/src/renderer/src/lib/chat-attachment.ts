// @ts-nocheck
import {
  CHAT_MAX_FILE_BYTES,
  CHAT_MAX_IMAGE_BYTES,
  CHAT_MAX_VIDEO_BYTES,
  ChatAttachmentType,
} from '@myinventory/shared'

export function classifyChatFile(file) {
  const mimeType = file.type || 'application/octet-stream'

  if (mimeType.startsWith('image/')) {
    return ChatAttachmentType.IMAGE
  }

  if (mimeType.startsWith('video/')) {
    return ChatAttachmentType.VIDEO
  }

  return ChatAttachmentType.FILE
}

export function getMaxBytesForChatFile(file) {
  const type = classifyChatFile(file)

  switch (type) {
    case ChatAttachmentType.IMAGE:
      return CHAT_MAX_IMAGE_BYTES
    case ChatAttachmentType.VIDEO:
      return CHAT_MAX_VIDEO_BYTES
    default:
      return CHAT_MAX_FILE_BYTES
  }
}

export function validateChatFile(file) {
  if (!file) {
    return 'No file selected'
  }

  const type = classifyChatFile(file)
  const maxBytes = getMaxBytesForChatFile(file)
  const limitMb = Math.round(maxBytes / (1024 * 1024))

  if (file.size > maxBytes) {
    const label =
      type === ChatAttachmentType.IMAGE
        ? 'Image'
        : type === ChatAttachmentType.VIDEO
          ? 'Video'
          : 'File'
    return limitMb === 50 ? 'Max size is 50 MB' : `${label} must be ${limitMb} MB or smaller`
  }

  return null
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
