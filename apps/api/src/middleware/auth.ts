import type { Request, Response, NextFunction } from 'express'
import type { AppFeature, JwtPayload, UserRole } from '@myinventory/shared'
import { getEffectiveFeatures } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from './error-handler.js'
import { verifyAccessToken } from '../utils/jwt.js'
import { loadSession } from '../lib/session-storage.js'
import {
  getCachedUserAuth,
  setCachedUserAuth,
} from '../lib/user-auth-cache.js'

export interface AuthenticatedUser extends JwtPayload {
  features: AppFeature[]
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser
}

async function resolveUserFromPayload(payload: JwtPayload): Promise<AuthenticatedUser> {
  const cached = await getCachedUserAuth(payload.sub)

  if (cached) {
    if (cached.status !== 'ACTIVE') {
      throw new AppError(401, 'User account is inactive or does not exist')
    }

    if (payload.orgId && cached.organizationId !== payload.orgId) {
      throw new AppError(401, 'Organization context is invalid')
    }

    return {
      ...payload,
      features: getEffectiveFeatures(cached.role, cached.extraFeatures),
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      status: true,
      organizationId: true,
      role: true,
      extraFeatures: true,
    },
  })

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(401, 'User account is inactive or does not exist')
  }

  if (payload.orgId && user.organizationId !== payload.orgId) {
    throw new AppError(401, 'Organization context is invalid')
  }

  const extraFeatures = (user.extraFeatures ?? []) as AppFeature[]
  const role = user.role as UserRole

  await setCachedUserAuth(payload.sub, {
    status: user.status,
    organizationId: user.organizationId,
    role,
    extraFeatures,
  })

  return {
    ...payload,
    features: getEffectiveFeatures(role, extraFeatures),
  }
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
