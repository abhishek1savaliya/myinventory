import { z } from 'zod'

export const sendChatMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000),
  replyToMessageId: z.string().min(1).optional(),
})

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>

export const forwardChatMessageSchema = z.object({
  messageId: z.string().min(1),
})

export type ForwardChatMessageInput = z.infer<typeof forwardChatMessageSchema>

export const chatMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
})

export type ChatMessagesQueryInput = z.infer<typeof chatMessagesQuerySchema>

export const createChatGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(100),
  memberIds: z.array(z.string().min(1)).max(200).default([]),
})

export type CreateChatGroupInput = z.infer<typeof createChatGroupSchema>

export const updateChatGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(100),
})

export type UpdateChatGroupInput = z.infer<typeof updateChatGroupSchema>

export const addChatGroupMembersSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(200),
})

export type AddChatGroupMembersInput = z.infer<typeof addChatGroupMembersSchema>

export const updateChatGroupMemberSchema = z.object({
  canSend: z.boolean(),
})

export type UpdateChatGroupMemberInput = z.infer<typeof updateChatGroupMemberSchema>

export const sendChatGroupMessageSchema = sendChatMessageSchema.extend({
  groupId: z.string().min(1),
})

export type SendChatGroupMessageInput = z.infer<typeof sendChatGroupMessageSchema>
