import type { AuthUser } from '@myinventory/shared'

import bcrypt from 'bcryptjs'

import { prisma } from '@myinventory/prisma'

import { env } from '../../config/env.js'

import { AppError } from '../../middleware/error-handler.js'

import { signAccessToken } from '../../utils/jwt.js'

import {
  createSessionId,
  parseSessionDurationHours,
  saveSession,
  sessionExpiresAt,
} from '../../lib/session-storage.js'

import { mapUserToAuthUser } from '../users/user.mapper.js'

import { UserRole } from '@myinventory/shared'

export async function loginUser(
  email: string,
  password: string,
): Promise<{ sessionId: string; token: string; user: AuthUser }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  })

  if (!user) {
    throw new AppError(401, 'Invalid email or password')
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(403, 'Your account is inactive. Contact an administrator.')
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)

  if (!passwordValid) {
    throw new AppError(401, 'Invalid email or password')
  }

  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
  })

  const sessionId = createSessionId()
  const sessionHours = parseSessionDurationHours(env.jwtExpiresIn)

  await saveSession(sessionId, {
    token,
    userId: user.id,
    expiresAt: sessionExpiresAt(sessionHours),
  })

  return {
    sessionId,
    token,
    user: mapUserToAuthUser(user),
  }
}



export async function getUserById(id: string): Promise<AuthUser> {

  const user = await prisma.user.findUnique({ where: { id } })



  if (!user) {

    throw new AppError(404, 'User not found')

  }



  return mapUserToAuthUser(user)

}



export async function listUsers(): Promise<AuthUser[]> {

  const users = await prisma.user.findMany({

    orderBy: { createdAt: 'desc' },

  })



  return users.map(mapUserToAuthUser)

}


