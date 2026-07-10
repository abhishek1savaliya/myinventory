import type { RequestHandler } from 'express'
import type { AppFeature, UserRole } from '@myinventory/shared'
import { AppError } from './error-handler.js'
import type { AuthenticatedRequest } from './auth.js'

export function requireRolesOrFeatures(
  roles: UserRole[],
  ...features: AppFeature[]
): RequestHandler {
  return (req, _res, next) => {
    const authReq = req as AuthenticatedRequest

    if (roles.includes(authReq.user.role as UserRole)) {
      next()
      return
    }

    const allowed = features.some((feature) => authReq.user.features.includes(feature))

    if (!allowed) {
      throw new AppError(403, 'You do not have permission to perform this action')
    }

    next()
  }
}
