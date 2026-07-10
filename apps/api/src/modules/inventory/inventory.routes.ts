import { Router } from 'express'
import {
  UserRole,
  AppFeature,
  adjustStockSchema,
  inventoryListQuerySchema,
  moveStockSchema,
  pickStockSchema,
  returnStockSchema,
  receiveStockSchema,
} from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { validateQuery } from '../../middleware/validate-query.js'
import { authenticate, type AuthenticatedRequest } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/rbac.js'
import { requireFeatures } from '../../middleware/feature-access.js'
import { requireOrgId } from '../../lib/org-context.js'
import {
  adjustStock,
  getInventoryByProduct,
  listInventory,
  moveStock,
  pickStock,
  receiveStock,
  returnStock,
} from './inventory.service.js'

const adjustRoles = [UserRole.ADMIN, UserRole.MANAGER]

export const inventoryRouter = Router()

inventoryRouter.get(
  '/inventory',
  asyncHandler(authenticate),
  validateQuery(inventoryListQuerySchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const result = await listInventory(orgId, req.query as never)
    res.json(result)
  }),
)

inventoryRouter.get(
  '/inventory/product/:productId',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const data = await getInventoryByProduct(orgId, req.params.productId)
    res.json({ data })
  }),
)

inventoryRouter.post(
  '/inventory/receive',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.RECEIVING),
  validateBody(receiveStockSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await receiveStock(orgId, req.body, user.sub)
    res.status(201).json({ data: result })
  }),
)

inventoryRouter.post(
  '/inventory/move',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.MOVEMENT),
  validateBody(moveStockSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await moveStock(orgId, req.body, user.sub)
    res.status(201).json({ data: result })
  }),
)

inventoryRouter.post(
  '/inventory/pick',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.PICKING),
  validateBody(pickStockSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await pickStock(orgId, req.body, user.sub)
    res.status(201).json({ data: result })
  }),
)

inventoryRouter.post(
  '/inventory/return',
  asyncHandler(authenticate),
  validateBody(returnStockSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await returnStock(orgId, req.body, user.sub)
    res.status(201).json({ data: result })
  }),
)

inventoryRouter.post(
  '/inventory/adjust',
  asyncHandler(authenticate),
  requireRoles(...adjustRoles),
  validateBody(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest
    const orgId = requireOrgId(req)
    const result = await adjustStock(orgId, req.body, user.sub, user.role)
    res.status(201).json({ data: result })
  }),
)
