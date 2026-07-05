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
import {
  createProduct,
  createProductFromScan,
  disableProduct,
  getProductByBarcode,
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
    const result = await listProducts(req.query as never)
    res.json(result)
  }),
)

productsRouter.get(
  '/products/barcode/:barcode',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.SCAN),
  asyncHandler(async (req, res) => {
    const product = await lookupProductByBarcodeForScan(req.params.barcode)
    res.json({ data: product })
  }),
)

productsRouter.get(
  '/products/:id',
  asyncHandler(authenticate),
  asyncHandler(async (req, res) => {
    const product = await getProductById(req.params.id)
    res.json({ data: product })
  }),
)

productsRouter.post(
  '/products/from-scan',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.SCAN),
  validateBody(createProductFromScanSchema),
  asyncHandler(async (req, res) => {
    const product = await createProductFromScan(req.body)
    res.status(201).json({ data: product })
  }),
)

productsRouter.post(
  '/products',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(createProductSchema),
  asyncHandler(async (req, res) => {
    const product = await createProduct(req.body)
    res.status(201).json({ data: product })
  }),
)

productsRouter.put(
  '/products/:id/from-scan',
  asyncHandler(authenticate),
  requireFeatures(AppFeature.SCAN, AppFeature.PRODUCTS),
  validateBody(updateProductFromScanSchema),
  asyncHandler(async (req, res) => {
    const product = await updateProductFromScan(req.params.id, req.body)
    res.json({ data: product })
  }),
)

productsRouter.put(
  '/products/:id',
  asyncHandler(authenticate),
  requireRoles(...manageRoles),
  validateBody(updateProductSchema),
  asyncHandler(async (req, res) => {
    const product = await updateProduct(req.params.id, req.body)
    res.json({ data: product })
  }),
)

productsRouter.patch(
  '/products/:id/disable',
  asyncHandler(authenticate),
  requireRolesOrFeatures(manageRoles, AppFeature.PRODUCT_DELETE),
  asyncHandler(async (req, res) => {
    const product = await disableProduct(req.params.id)
    res.json({ data: product })
  }),
)
