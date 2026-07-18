import multer from 'multer'
import { CHAT_MAX_VIDEO_BYTES } from '@myinventory/shared'

export const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CHAT_MAX_VIDEO_BYTES,
    files: 1,
  },
})

export const chatGroupPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1,
  },
})
