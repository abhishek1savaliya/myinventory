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
