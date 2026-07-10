import multer from 'multer'
import { CHAT_MAX_VIDEO_BYTES } from '@myinventory/shared'

export const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CHAT_MAX_VIDEO_BYTES,
    files: 1,
  },
})
