import { Router } from 'express'
import multer from 'multer'
import { loginSchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { deleteSession } from '../../lib/session-storage.js'
import { getUserById, loginUser, updateUserProfilePhoto } from './auth.service.js'
import { deleteProfilePhoto, uploadProfilePhoto } from '../../lib/profile-photos.js'

export const authRouter = Router()
const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
})

authRouter.post(
  '/auth/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { orgId, email, password } = req.body as {
      orgId: string
      email: string
      password: string
    }
    const result = await loginUser(orgId, email, password)
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

authRouter.post(
  '/auth/profile-photo',
  asyncHandler(authenticate),
  profilePhotoUpload.single('photo'),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    if (!req.file) {
      res.status(400).json({ message: 'Choose a profile photo to upload' })
      return
    }

    const current = await getUserById(user.sub)
    const profilePhotoUrl = await uploadProfilePhoto(user.orgId, user.sub, req.file)
    const updated = await updateUserProfilePhoto(user.sub, profilePhotoUrl)
    await deleteProfilePhoto(current.profilePhotoUrl)
    res.json({ user: updated })
  }),
)

authRouter.delete(
  '/auth/profile-photo',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const current = await getUserById(user.sub)
    const updated = await updateUserProfilePhoto(user.sub, null)
    await deleteProfilePhoto(current.profilePhotoUrl)
    res.json({ user: updated })
  }),
)
