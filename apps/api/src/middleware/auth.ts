import type { Request, Response, NextFunction } from 'express'
import type { JwtPayload } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from './error-handler.js'
import { verifyAccessToken } from '../utils/jwt.js'
import { loadSession } from '../lib/session-storage.js'

export interface AuthenticatedRequest extends Request {
  user: JwtPayload
}

async function resolveUserFromPayload(payload: JwtPayload): Promise<JwtPayload> {
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, status: true, organizationId: true },
  })

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'User account is inactive or does not exist')
  }

  if (payload.orgId && user.organizationId !== payload.orgId) {
    throw new AppError(401, 'Organization context is invalid')
  }

  return payload
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId = req.header('x-session-id')?.trim()

  if (sessionId) {
    const session = await loadSession(sessionId)
    if (!session) {
      throw new AppError(401, 'Session expired or invalid')
    }

    const payload = await resolveUserFromPayload(verifyAccessToken(session.token))
    ;(req as AuthenticatedRequest).user = payload
    next()
    return
  }

  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Authentication required')
  }

  const token = header.slice(7)
  const payload = await resolveUserFromPayload(verifyAccessToken(token))
  ;(req as AuthenticatedRequest).user = payload
  next()
}
