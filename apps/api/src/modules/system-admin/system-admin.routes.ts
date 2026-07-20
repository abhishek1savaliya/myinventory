import type { Request, Response, NextFunction } from 'express'
import { Router } from 'express'
import { asyncHandler } from '../../utils/async-handler.js'
import {
  disableOrganizationForSystemAdmin,
  enableOrganizationForSystemAdmin,
  getOrganizationDetailsForSystemAdmin,
  listOrganizationsForSystemAdmin,
} from './system-admin.service.js'
import { AppError } from '../../middleware/error-handler.js'
import { env } from '../../config/env.js'

const SYSTEM_ADMIN_IDS = new Set(env.systemAdminIds.split(',').map((id) => id.trim()))

async function authenticateSystemAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const adminId = req.header('x-system-admin-id')?.trim()
  const password = req.header('x-system-admin-password')?.trim()

  if (!adminId || !password) {
    throw new AppError(401, 'System admin authentication required')
  }

  if (!SYSTEM_ADMIN_IDS.has(adminId) || password !== env.systemAdminPassword) {
    throw new AppError(401, 'Invalid system admin credentials')
  }

  next()
}

export const systemAdminRouter = Router()

systemAdminRouter.use(asyncHandler(authenticateSystemAdmin))

systemAdminRouter.get(
  '/organizations',
  asyncHandler(async (_req, res) => {
    const organizations = await listOrganizationsForSystemAdmin()
    res.json({ data: organizations })
  }),
)

systemAdminRouter.get(
  '/organizations/:organizationId',
  asyncHandler(async (req, res) => {
    const organization = await getOrganizationDetailsForSystemAdmin(req.params.organizationId)
    res.json({ data: organization })
  }),
)

systemAdminRouter.post(
  '/organizations/:organizationId/disable',
  asyncHandler(async (req, res) => {
    const result = await disableOrganizationForSystemAdmin(req.params.organizationId)
    res.json(result)
  }),
)

systemAdminRouter.post(
  '/organizations/:organizationId/enable',
  asyncHandler(async (req, res) => {
    const result = await enableOrganizationForSystemAdmin(req.params.organizationId)
    res.json(result)
  }),
)
