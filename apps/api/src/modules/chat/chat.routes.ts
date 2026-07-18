import { Router } from 'express'
import {
  AppFeature,
  UserRole,
  addChatGroupMembersSchema,
  chatMessagesQuerySchema,
  createChatGroupSchema,
  forwardChatMessageSchema,
  sendChatMessageSchema,
  updateChatGroupMemberSchema,
  updateChatGroupSchema,
} from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { requireFeatures } from '../../middleware/feature-access.js'
import { requireRoles } from '../../middleware/rbac.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { requireOrgId } from '../../lib/org-context.js'
import { AppError } from '../../middleware/error-handler.js'
import {
  deleteChatMessageForEveryone,
  deleteChatMessageForMe,
  addChatGroupMembers,
  createChatGroup,
  forwardChatMessage,
  getChatGroup,
  getChatGroupMessages,
  getConversationMessages,
  getTotalUnreadCount,
  listChatUsers,
  listChatGroups,
  listConversations,
  markChatGroupRead,
  markConversationRead,
  removeChatGroupMember,
  sendChatGroupAttachmentMessage,
  sendChatGroupMessage,
  sendChatAttachmentMessage,
  sendChatMessage,
  updateChatGroup,
  updateChatGroupMemberCanSend,
} from './chat.service.js'
import { chatAttachmentUpload } from './chat.upload.js'
import {
  emitChatGroupMembershipUpdated,
  emitChatGroupMessage,
  emitChatGroupRead,
  emitChatMessage,
  emitChatMessageDeleted,
  emitChatRead,
} from './chat.socket.js'

export const chatRouter = Router()
const groupManageRoles = [UserRole.ADMIN, UserRole.MANAGER]

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

chatRouter.post(
  '/chat/groups',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  requireRoles(...groupManageRoles),
  validateBody(createChatGroupSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const group = await createChatGroup(orgId, user.sub, user.role, req.body)
    emitChatGroupMembershipUpdated({
      groupId: group.id,
      group,
      addedUserIds: group.members.map((member) => member.user.id),
      removedUserIds: [],
      actorId: user.sub,
    })
    res.status(201).json({ data: group })
  }),
)

chatRouter.get(
  '/chat/groups',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const groups = await listChatGroups(requireOrgId(req), user.sub, user.role)
    res.json({ data: groups })
  }),
)

chatRouter.get(
  '/chat/groups/:groupId',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const group = await getChatGroup(requireOrgId(req), user.sub, user.role, req.params.groupId)
    res.json({ data: group })
  }),
)

chatRouter.patch(
  '/chat/groups/:groupId',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  requireRoles(...groupManageRoles),
  validateBody(updateChatGroupSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const group = await updateChatGroup(
      requireOrgId(req),
      user.sub,
      user.role,
      req.params.groupId,
      req.body.name,
    )
    emitChatGroupMembershipUpdated({
      groupId: group.id,
      group,
      addedUserIds: [],
      removedUserIds: [],
      actorId: user.sub,
    })
    res.json({ data: group })
  }),
)

chatRouter.post(
  '/chat/groups/:groupId/members',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  requireRoles(...groupManageRoles),
  validateBody(addChatGroupMembersSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const result = await addChatGroupMembers(
      requireOrgId(req),
      user.sub,
      user.role,
      req.params.groupId,
      req.body.userIds,
    )
    emitChatGroupMembershipUpdated({
      groupId: result.group.id,
      group: result.group,
      addedUserIds: result.addedUserIds,
      removedUserIds: [],
      actorId: user.sub,
    })
    res.json({ data: result.group })
  }),
)

chatRouter.delete(
  '/chat/groups/:groupId/members/:userId',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  requireRoles(...groupManageRoles),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const result = await removeChatGroupMember(
      requireOrgId(req),
      user.sub,
      user.role,
      req.params.groupId,
      req.params.userId,
    )
    emitChatGroupMembershipUpdated({
      groupId: result.group.id,
      group: result.group,
      addedUserIds: [],
      removedUserIds: [result.removedUserId],
      actorId: user.sub,
    })
    res.json({ data: result.group })
  }),
)

chatRouter.patch(
  '/chat/groups/:groupId/members/:userId',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  requireRoles(...groupManageRoles),
  validateBody(updateChatGroupMemberSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const group = await updateChatGroupMemberCanSend(
      requireOrgId(req),
      user.sub,
      user.role,
      req.params.groupId,
      req.params.userId,
      req.body.canSend,
    )
    emitChatGroupMembershipUpdated({
      groupId: group.id,
      group,
      addedUserIds: [],
      removedUserIds: [],
      canSendUpdates: [{ userId: req.params.userId, canSend: req.body.canSend }],
      actorId: user.sub,
    })
    res.json({ data: group })
  }),
)

chatRouter.get(
  '/chat/groups/:groupId/messages',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  validateQuery(chatMessagesQuerySchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const query = chatMessagesQuerySchema.parse(req.query)
    const messages = await getChatGroupMessages(
      requireOrgId(req),
      user.sub,
      req.params.groupId,
      query,
    )
    res.json({ data: messages })
  }),
)

chatRouter.post(
  '/chat/groups/:groupId/messages',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  validateBody(sendChatMessageSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const message = await sendChatGroupMessage(
      requireOrgId(req),
      user.sub,
      req.params.groupId,
      req.body.body,
      req.body.replyToMessageId,
    )
    emitChatGroupMessage(message)
    res.status(201).json({ data: message })
  }),
)

chatRouter.post(
  '/chat/groups/:groupId/messages/attachment',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  (req, res, next) => {
    chatAttachmentUpload.single('file')(req, res, (error: unknown) => {
      if (!error) {
        next()
        return
      }
      const multerError = error as { code?: string }
      next(
        multerError.code === 'LIMIT_FILE_SIZE'
          ? new AppError(400, 'File exceeds the maximum allowed size')
          : error instanceof Error
            ? error
            : new AppError(400, 'Upload failed'),
      )
    })
  },
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    if (!req.file) {
      throw new AppError(400, 'A file is required')
    }
    const message = await sendChatGroupAttachmentMessage(
      requireOrgId(req),
      user.sub,
      req.params.groupId,
      {
        buffer: req.file.buffer,
        mimeType: req.file.mimetype || 'application/octet-stream',
        fileName: req.file.originalname || 'attachment',
        body: typeof req.body?.body === 'string' ? req.body.body : '',
      },
    )
    emitChatGroupMessage(message)
    res.status(201).json({ data: message })
  }),
)

chatRouter.post(
  '/chat/groups/:groupId/read',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.CHAT),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const result = await markChatGroupRead(requireOrgId(req), user.sub, req.params.groupId)
    emitChatGroupRead(req.params.groupId, user.sub, result)
    res.json({ data: result })
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
