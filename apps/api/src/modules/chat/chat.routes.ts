import { Router } from 'express'
import { AppFeature, chatMessagesQuerySchema, sendChatMessageSchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { requireFeatures } from '../../middleware/feature-access.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { requireOrgId } from '../../lib/org-context.js'
import {
  getConversationMessages,
  getTotalUnreadCount,
  listChatUsers,
  listConversations,
  markConversationRead,
  sendChatMessage,
} from './chat.service.js'
import { emitChatMessage } from './chat.socket.js'

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
  '/chat/messages/:partnerId',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  validateBody(sendChatMessageSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const message = await sendChatMessage(orgId, user.sub, req.params.partnerId, req.body.body)
    emitChatMessage(message)
    res.status(201).json({ data: message })
  }),
)

chatRouter.post(
  '/chat/messages/:partnerId/read',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const count = await markConversationRead(orgId, user.sub, req.params.partnerId)
    res.json({ data: { count } })
  }),
)
