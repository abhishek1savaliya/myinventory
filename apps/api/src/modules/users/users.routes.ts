import { Router } from 'express'
import { UserRole, createUserSchema, updateUserFeaturesSchema } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/rbac.js'
import { listUsers } from '../auth/auth.service.js'
import {
  acceptDisableRequest,
  activateUser,
  createUser,
  listIncomingDisableRequests,
  rejectDisableRequest,
  requestDisableUser,
  updateUserFeatures,
} from './users.service.js'

export const usersRouter = Router()

usersRouter.get(
  '/users',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    const users = await listUsers()
    res.json({ data: users })
  }),
)

usersRouter.post(
  '/users',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body)
    res.status(201).json({ data: user })
  }),
)

usersRouter.patch(
  '/users/:id/disable',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const result = await requestDisableUser(req.params.id, user.sub)
    res.json({ data: result })
  }),
)

usersRouter.patch(
  '/users/:id/activate',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const user = await activateUser(req.params.id)
    res.json({ data: user })
  }),
)

usersRouter.patch(
  '/users/:id/features',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  validateBody(updateUserFeaturesSchema),
  asyncHandler(async (req, res) => {
    const user = await updateUserFeatures(req.params.id, req.body)
    res.json({ data: user })
  }),
)

usersRouter.get(
  '/users/disable-requests/incoming',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const requests = await listIncomingDisableRequests(user.sub)
    res.json({ data: requests })
  }),
)

usersRouter.post(
  '/users/disable-requests/:id/accept',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const result = await acceptDisableRequest(req.params.id, user.sub)
    res.json({ data: result })
  }),
)

usersRouter.post(
  '/users/disable-requests/:id/reject',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const result = await rejectDisableRequest(req.params.id, user.sub)
    res.json({ data: result })
  }),
)
