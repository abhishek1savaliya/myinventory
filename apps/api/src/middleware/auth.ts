import type { Request, Response, NextFunction } from 'express'
import type { JwtPayload } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from './error-handler.js'
import { verifyAccessToken } from '../utils/jwt.js'

export interface AuthenticatedRequest extends Request {
  user: JwtPayload
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Authentication required')
  }

  const token = header.slice(7)
  const payload = verifyAccessToken(token)

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, status: true },
  })

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'User account is inactive or does not exist')
  }

  ;(req as AuthenticatedRequest).user = payload
  next()
}
