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
    const result = await listLocations(req.query as never)
    res.json(result)
  }),
)

locationsRouter.get(
  '/locations/:id',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const location = await getLocationById(req.params.id)
    res.json({ data: location })
  }),
)

locationsRouter.post(
  '/locations',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(createLocationSchema),
  asyncHandler(async (req, res) => {
    const location = await createLocation(req.body)
    res.status(201).json({ data: location })
  }),
)

locationsRouter.put(
  '/locations/:id',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(updateLocationSchema),
  asyncHandler(async (req, res) => {
    const location = await updateLocation(req.params.id, req.body)
    res.json({ data: location })
  }),
)
