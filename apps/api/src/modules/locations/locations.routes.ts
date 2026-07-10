import { Router } from 'express'
import {
  UserRole,
  createLocationSchema,
  locationListQuerySchema,
  updateLocationSchema,
} from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { validateQuery } from '../../middleware/validate-query.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/rbac.js'
import { requireOrgId } from '../../lib/org-context.js'
import {
  createLocation,
  getLocationById,
  listLocations,
  updateLocation,
} from './locations.service.js'

const manageRoles = [UserRole.ADMIN, UserRole.MANAGER]

export const locationsRouter = Router()

locationsRouter.get(
  '/locations',
  asyncHandler(authenticate),
  validateQuery(locationListQuerySchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const result = await listLocations(orgId, req.query as never)
    res.json(result)
  }),
)

locationsRouter.get(
  '/locations/:id',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const location = await getLocationById(orgId, req.params.id)
    res.json({ data: location })
  }),
)

locationsRouter.post(
  '/locations',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(createLocationSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const location = await createLocation(orgId, req.body)
    res.status(201).json({ data: location })
  }),
)

locationsRouter.put(
  '/locations/:id',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(updateLocationSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const location = await updateLocation(orgId, req.params.id, req.body)
    res.json({ data: location })
  }),
)
