import { Router } from 'express'
import { loginSchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { deleteSession } from '../../lib/session-storage.js'
import { getUserById, loginUser } from './auth.service.js'

export const authRouter = Router()

authRouter.post(
  '/auth/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string }
    const result = await loginUser(email, password)
    res.json({
      sessionId: result.sessionId,
      user: result.user,
      token: result.token,
    })
  }),
)

authRouter.post(
  '/auth/logout',
  asyncHandler(async (req, res) => {
    const sessionId = req.header('x-session-id')?.trim()
    if (sessionId) {
      await deleteSession(sessionId)
    }
    res.status(204).send()
  }),
)

authRouter.get(
  '/auth/me',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const profile = await getUserById(user.sub)
    res.json({ user: profile })
  }),
)
