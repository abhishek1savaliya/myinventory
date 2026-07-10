import type { RequestHandler } from 'express'
import type { AppFeature } from '@myinventory/shared'
import { AppError } from './error-handler.js'
import type { AuthenticatedRequest } from './auth.js'

export function requireFeatures(...features: AppFeature[]): RequestHandler {
  return (req, _res, next) => {
    const authReq = req as AuthenticatedRequest
    const allowed = features.some((feature) => authReq.user.features.includes(feature))

    if (!allowed) {
      throw new AppError(403, 'You do not have permission to perform this action')
    }

    next()
  }
}
