import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { UserRole } from '@myinventory/shared'
import { AppError } from './error-handler.js'
import type { AuthenticatedRequest } from './auth.js'

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest

    if (!roles.includes(authReq.user.role)) {
      throw new AppError(403, 'You do not have permission to perform this action')
    }

    next()
  }
}
