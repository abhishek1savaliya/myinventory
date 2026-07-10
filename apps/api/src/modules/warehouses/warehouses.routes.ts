import { Router } from 'express'
import {
  UserRole,
  createWarehouseSchema,
  updateWarehouseSchema,
  warehouseListQuerySchema,
} from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { validateQuery } from '../../middleware/validate-query.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/rbac.js'
import { requireOrgId } from '../../lib/org-context.js'
import {
  createWarehouse,
  getWarehouseById,
  listWarehouses,
  updateWarehouse,
} from './warehouses.service.js'

const manageRoles = [UserRole.ADMIN, UserRole.MANAGER]

export const warehousesRouter = Router()

warehousesRouter.get(
  '/warehouses',
  asyncHandler(authenticate),
  validateQuery(warehouseListQuerySchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const result = await listWarehouses(orgId, req.query as never)
    res.json(result)
  }),
)

warehousesRouter.get(
  '/warehouses/:id',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const warehouse = await getWarehouseById(orgId, req.params.id)
    res.json({ data: warehouse })
  }),
)

warehousesRouter.post(
  '/warehouses',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(createWarehouseSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const warehouse = await createWarehouse(orgId, req.body)
    res.status(201).json({ data: warehouse })
  }),
)

warehousesRouter.put(
  '/warehouses/:id',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(updateWarehouseSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const warehouse = await updateWarehouse(orgId, req.params.id, req.body)
    res.json({ data: warehouse })
  }),
)
