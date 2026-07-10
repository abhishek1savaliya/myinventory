import { Router } from 'express'
import {
  UserRole,
  createProductSchema,
  createProductFromScanSchema,
  productListQuerySchema,
  updateProductSchema,
  updateProductFromScanSchema,
} from '@myinventory/shared'
import { AppFeature } from '@myinventory/shared'
import { asyncHandler } from '../../utils/async-handler.js'
import { validateBody } from '../../middleware/validate.js'
import { validateQuery } from '../../middleware/validate-query.js'
import { authenticate } from '../../middleware/auth.js'
import { requireRoles } from '../../middleware/rbac.js'
import { requireFeatures } from '../../middleware/feature-access.js'
import { requireRolesOrFeatures } from '../../middleware/require-roles-or-features.js'
import { requireOrgId } from '../../lib/org-context.js'
import {
  createProduct,
  createProductFromScan,
  disableProduct,
  getProductById,
  listProducts,
  lookupProductByBarcodeForScan,
  updateProduct,
  updateProductFromScan,
} from './products.service.js'

const manageRoles = [UserRole.ADMIN, UserRole.MANAGER]

export const productsRouter = Router()

productsRouter.get(
  '/products',
  asyncHandler(authenticate),
  validateQuery(productListQuerySchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const result = await listProducts(orgId, req.query as never)
    res.json(result)
  }),
)

productsRouter.get(
  '/products/barcode/:barcode',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.SCAN),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const product = await lookupProductByBarcodeForScan(orgId, req.params.barcode)
    res.json({ data: product })
  }),
)

productsRouter.get(
  '/products/:id',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const product = await getProductById(orgId, req.params.id)
    res.json({ data: product })
  }),
)

productsRouter.post(
  '/products/from-scan',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.SCAN),
  validateBody(createProductFromScanSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const product = await createProductFromScan(orgId, req.body)
    res.status(201).json({ data: product })
  }),
)

productsRouter.post(
  '/products',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(createProductSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const product = await createProduct(orgId, req.body)
    res.status(201).json({ data: product })
  }),
)

productsRouter.put(
  '/products/:id/from-scan',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.SCAN, AppFeature.PRODUCTS),
  validateBody(updateProductFromScanSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const product = await updateProductFromScan(orgId, req.params.id, req.body)
    res.json({ data: product })
  }),
)

productsRouter.put(
  '/products/:id',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(updateProductSchema),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const product = await updateProduct(orgId, req.params.id, req.body)
    res.json({ data: product })
  }),
)

productsRouter.patch(
  '/products/:id/disable',
  asyncHandler(authenticate),
  requireRolesOrFeatures(manageRoles, AppFeature.PRODUCT_DELETE),
  asyncHandler(async (req, res) => {
    const orgId = requireOrgId(req)
    const product = await disableProduct(orgId, req.params.id)
    res.json({ data: product })
  }),
)
