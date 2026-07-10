import type { AuthenticatedRequest } from '../middleware/auth.js'
import type { Request } from 'express'
import { AppError } from '../middleware/error-handler.js'

export function requireOrgId(req: Request): string {
  const { user } = req as AuthenticatedRequest

  if (!user?.orgId) {
    throw new AppError(401, 'Organization context missing')
  }

  return user.orgId
}

export function requireOrgSlug(req: Request): string {
  const { user } = req as AuthenticatedRequest

  if (!user?.orgSlug) {
    throw new AppError(401, 'Organization context missing')
  }

  return user.orgSlug
}
