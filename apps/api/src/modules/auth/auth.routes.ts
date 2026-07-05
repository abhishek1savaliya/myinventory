import { Router } from 'express'
import { loginSchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getUserById, loginUser } from './auth.service.js'

export const authRouter = Router()

authRouter.post(
  '/auth/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string }
    const result = await loginUser(email, password)
    res.json(result)
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
