import { Router } from 'express'
import { AppFeature, chatMessagesQuerySchema, forwardChatMessageSchema, sendChatMessageSchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { requireFeatures } from '../../middleware/feature-access.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { requireOrgId } from '../../lib/org-context.js'
import { AppError } from '../../middleware/error-handler.js'
import {
  deleteChatMessageForEveryone,
  deleteChatMessageForMe,
  forwardChatMessage,
  getConversationMessages,
  getTotalUnreadCount,
  listChatUsers,
  listConversations,
  markConversationRead,
  sendChatAttachmentMessage,
  sendChatMessage,
} from './chat.service.js'
import { chatAttachmentUpload } from './chat.upload.js'
import { emitChatMessage, emitChatMessageDeleted, emitChatRead } from './chat.socket.js'

export const chatRouter = Router()

chatRouter.get(
  '/chat/users',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const users = await listChatUsers(orgId, user.sub)
    res.json({ data: users })
  }),
)

chatRouter.get(
  '/chat/conversations',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const conversations = await listConversations(orgId, user.sub)
    res.json({ data: conversations })
  }),
)

chatRouter.get(
  '/chat/unread-count',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const count = await getTotalUnreadCount(orgId, user.sub)
    res.json({ data: { count } })
  }),
)

chatRouter.get(
  '/chat/messages/:partnerId',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  validateQuery(chatMessagesQuerySchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const query = chatMessagesQuerySchema.parse(req.query)
    const messages = await getConversationMessages(orgId, user.sub, req.params.partnerId, {
      limit: query.limit,
      before: query.before,
    })
    res.json({ data: messages })
  }),
)

chatRouter.post(
  '/chat/messages/:partnerId/attachment',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  (req, res, next) => {
    chatAttachmentUpload.single('file')(req, res, (error: unknown) => {
      if (error) {
        const multerError = error as { code?: string; message?: string }
        if (multerError.code === 'LIMIT_FILE_SIZE') {
          next(new AppError(400, 'File exceeds the maximum allowed size'))
          return
        }
        next(error instanceof Error ? error : new AppError(400, 'Upload failed'))
        return
      }
      next()
    })
  },
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const file = req.file

    if (!file) {
      res.status(400).json({ message: 'A file is required' })
      return
    }

    const caption = typeof req.body?.body === 'string' ? req.body.body : ''

    const message = await sendChatAttachmentMessage(orgId, user.sub, req.params.partnerId, {
      buffer: file.buffer,
      mimeType: file.mimetype || 'application/octet-stream',
      fileName: file.originalname || 'attachment',
      body: caption,
    })

    emitChatMessage(message)
    res.status(201).json({ data: message })
  }),
)

chatRouter.post(
  '/chat/messages/:partnerId',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  validateBody(sendChatMessageSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const message = await sendChatMessage(
      orgId,
      user.sub,
      req.params.partnerId,
      req.body.body,
      req.body.replyToMessageId,
    )
    emitChatMessage(message)
    res.status(201).json({ data: message })
  }),
)

chatRouter.post(
  '/chat/messages/:partnerId/forward',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  validateBody(forwardChatMessageSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const message = await forwardChatMessage(
      orgId,
      user.sub,
      req.params.partnerId,
      req.body.messageId,
    )
    emitChatMessage(message)
    res.status(201).json({ data: message })
  }),
)

chatRouter.delete(
  '/chat/messages/:messageId/for-me',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await deleteChatMessageForMe(orgId, user.sub, req.params.messageId)
    res.json({ data: result })
  }),
)

chatRouter.delete(
  '/chat/messages/:messageId/for-everyone',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await deleteChatMessageForEveryone(orgId, user.sub, req.params.messageId)
    emitChatMessageDeleted({
      message: result.message,
      partnerId: result.partnerId,
      actorId: user.sub,
      scope: 'everyone',
    })
    res.json({ data: result.message })
  }),
)

chatRouter.post(
  '/chat/messages/:partnerId/read',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await markConversationRead(orgId, user.sub, req.params.partnerId)
    emitChatRead(req.params.partnerId, user.sub, result)
    res.json({ data: result })
  }),
)
