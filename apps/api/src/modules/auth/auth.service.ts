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

import { mapUserToAuthUser, userWithOrganizationInclude } from '../users/user.mapper.js'

import { UserRole } from '@myinventory/shared'

import { findOrganizationByOrgCode } from '../organizations/organizations.service.js'

export async function loginUser(
  orgCode: string,
  email: string,
  password: string,
): Promise<{ sessionId: string; token: string; user: AuthUser }> {
  const organization = await findOrganizationByOrgCode(orgCode)

  if (!organization) {
    throw new AppError(401, 'Invalid organization ID, email, or password')
  }

  const user = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId: organization.id,
        email: email.toLowerCase().trim(),
      },
    },
    include: userWithOrganizationInclude,
  })

  if (!user) {
    throw new AppError(401, 'Invalid organization ID, email, or password')
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(403, 'Your account is inactive. Contact an administrator.')
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)

  if (!passwordValid) {
    throw new AppError(401, 'Invalid organization ID, email, or password')
  }

  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    orgId: organization.id,
    orgSlug: organization.slug,
    orgCode: organization.orgCode,
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
  const user = await prisma.user.findUnique({
    where: { id },
    include: userWithOrganizationInclude,
  })

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  return mapUserToAuthUser(user)
}

export async function updateUserProfilePhoto(id: string, profilePhotoUrl: string | null): Promise<AuthUser> {
  const user = await prisma.user.update({
    where: { id },
    data: { profilePhotoUrl },
    include: userWithOrganizationInclude,
  })

  return mapUserToAuthUser(user)
}

export async function listUsers(organizationId: string): Promise<AuthUser[]> {
  const users = await prisma.user.findMany({
    where: { organizationId },
    include: userWithOrganizationInclude,
    orderBy: { createdAt: 'desc' },
  })

  return users.map(mapUserToAuthUser)
}
