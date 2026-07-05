import type { RequestHandler } from 'express'
import type { AppFeature } from '@myinventory/shared'
import { AppError } from './error-handler.js'
import type { AuthenticatedRequest } from './auth.js'
import { getUserFeaturesById } from '../modules/users/user-features.js'

export function requireFeatures(...features: AppFeature[]): RequestHandler {
  return async (req, _res, next) => {
    const authReq = req as AuthenticatedRequest
    const userFeatures = await getUserFeaturesById(authReq.user.sub)

    const allowed = features.some((feature) => userFeatures.includes(feature))

    if (!allowed) {
      throw new AppError(403, 'You do not have permission to perform this action')
    }

    next()
  }
}
