import { Router } from 'express'
import {
  UserRole,
  createUserSchema,
  resetUserPasswordSchema,
  updateUserFeaturesSchema,
  updateUserRoleSchema,
} from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/rbac.js'
import { requireOrgId } from '../../lib/org-context.js'
import { listUsers } from '../auth/auth.service.js'
import {
  acceptDisableRequest,
  activateUser,
  createUser,
  listIncomingDisableRequests,
  rejectDisableRequest,
  requestDisableUser,
  resetUserPassword,
  updateUserFeatures,
  updateUserRole,
} from './users.service.js'

export const usersRouter = Router()

usersRouter.get(
  '/users',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const users = await listUsers(orgId)
    res.json({ data: users })
  }),
)

usersRouter.post(
  '/users',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const user = await createUser(orgId, req.body)
    res.status(201).json({ data: user })
  }),
)

usersRouter.patch(
  '/users/:id/disable',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await requestDisableUser(orgId, req.params.id, user.sub)
    res.json({ data: result })
  }),
)

usersRouter.patch(
  '/users/:id/activate',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const user = await activateUser(orgId, req.params.id)
    res.json({ data: user })
  }),
)

usersRouter.patch(
  '/users/:id/features',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  validateBody(updateUserFeaturesSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const user = await updateUserFeatures(orgId, req.params.id, req.body)
    res.json({ data: user })
  }),
)

usersRouter.patch(
  '/users/:id/role',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  validateBody(updateUserRoleSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const updated = await updateUserRole(orgId, req.params.id, user.sub, req.body)
    res.json({ data: updated })
  }),
)

usersRouter.post(
  '/users/:id/reset-password',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  validateBody(resetUserPasswordSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const result = await resetUserPassword(orgId, req.params.id, req.body)
    res.json({ data: result })
  }),
)

usersRouter.get(
  '/users/disable-requests/incoming',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const requests = await listIncomingDisableRequests(orgId, user.sub)
    res.json({ data: requests })
  }),
)

usersRouter.post(
  '/users/disable-requests/:id/accept',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await acceptDisableRequest(orgId, req.params.id, user.sub)
    res.json({ data: result })
  }),
)

usersRouter.post(
  '/users/disable-requests/:id/reject',
  asyncHandler(authenticate),
  requireRoles(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await rejectDisableRequest(orgId, req.params.id, user.sub)
    res.json({ data: result })
  }),
)
