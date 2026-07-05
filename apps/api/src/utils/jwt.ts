import jwt from 'jsonwebtoken'
import type { JwtPayload } from '@myinventory/shared'
import { env } from '../config/env.js'
import { AppError } from '../middleware/error-handler.js'

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload
  } catch {
    throw new AppError(401, 'Invalid or expired token')
  }
}
