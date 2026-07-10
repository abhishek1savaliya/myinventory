import type { User, UserDisableRequest } from '@prisma/client'
import type {
  AuthUser,
  CreateUserInput,
  DisableUserResponse,
  UpdateUserFeaturesInput,
  UpdateUserRoleInput,
  UserDisableRequestDto,
} from '@myinventory/shared'
import { UserRole, UserStatus, computeExtraFeatures, getEffectiveFeatures, AppFeature } from '@myinventory/shared'
import bcrypt from 'bcryptjs'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import { mapUserToAuthUser, toPrismaFeatures, userWithOrganizationInclude } from './user.mapper.js'

type DisableRequestWithUsers = UserDisableRequest & {
  targetUser: User
  requestedBy: User
}

function toDisableRequestDto(request: DisableRequestWithUsers): UserDisableRequestDto {
  return {
    id: request.id,
    targetUserId: request.targetUserId,
    targetUserName: request.targetUser.name,
    targetUserEmail: request.targetUser.email,
    requestedById: request.requestedById,
    requestedByName: request.requestedBy.name,
    requestedByEmail: request.requestedBy.email,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    resolvedAt: request.resolvedAt?.toISOString() ?? null,
  }
}

async function getUserInOrganization(userId: string, organizationId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
  })

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  return user
}

async function countActiveAdmins(organizationId: string, excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      organizationId,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  })
}

async function ensureMinimumOneAdminAfterDisable(
  organizationId: string,
  targetUserId: string,
): Promise<void> {
  const target = await getUserInOrganization(targetUserId, organizationId)

  if (target.role !== UserRole.ADMIN) {
    return
  }

  const remaining = await countActiveAdmins(organizationId, targetUserId)

  if (remaining < 1) {
    throw new AppError(400, 'At least one active admin must remain in the organization')
  }
}

async function reloadAuthUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithOrganizationInclude,
  })

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  return mapUserToAuthUser(user)
}

export async function createUser(organizationId: string, input: CreateUserInput): Promise<AuthUser> {
  const email = input.email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId,
        email,
      },
    },
  })

  if (existing) {
    throw new AppError(409, 'A user with this email already exists in this organization')
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    const user = await prisma.user.create({
      data: {
        organizationId,
        name: input.name.trim(),
        email,
        passwordHash,
        role: input.role,
      },
      include: userWithOrganizationInclude,
    })

    return mapUserToAuthUser(user)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError(409, 'A user with this email already exists in this organization')
    }
    throw error
  }
}

export async function requestDisableUser(
  organizationId: string,
  targetUserId: string,
  requestedById: string,
): Promise<DisableUserResponse> {
  if (targetUserId === requestedById) {
    throw new AppError(400, 'You cannot disable your own account')
  }

  const [target, requester] = await Promise.all([
    getUserInOrganization(targetUserId, organizationId),
    getUserInOrganization(requestedById, organizationId),
  ])

  if (target.status !== UserStatus.ACTIVE) {
    throw new AppError(400, 'User is already inactive')
  }

  if (requester.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can disable users')
  }

  await ensureMinimumOneAdminAfterDisable(organizationId, targetUserId)

  if (target.role === UserRole.ADMIN) {
    const existingPending = await prisma.userDisableRequest.findFirst({
      where: {
        targetUserId,
        requestedById,
        status: 'PENDING',
      },
    })

    if (existingPending) {
      return {
        disabled: false,
        pendingApproval: true,
        requestId: existingPending.id,
        message: `A disable request is already pending for ${target.email}`,
      }
    }

    const request = await prisma.userDisableRequest.create({
      data: {
        targetUserId,
        requestedById,
      },
    })

    return {
      disabled: false,
      pendingApproval: true,
      requestId: request.id,
      message: `Disable request sent to ${target.name}. They must accept before the account is disabled.`,
    }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { status: UserStatus.INACTIVE },
  })

  return {
    disabled: true,
    message: `${target.name} has been disabled`,
  }
}

export async function listIncomingDisableRequests(
  organizationId: string,
  userId: string,
): Promise<UserDisableRequestDto[]> {
  await getUserInOrganization(userId, organizationId)

  const requests = await prisma.userDisableRequest.findMany({
    where: {
      targetUserId: userId,
      status: 'PENDING',
    },
    include: {
      targetUser: true,
      requestedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return requests.map(toDisableRequestDto)
}

export async function acceptDisableRequest(
  organizationId: string,
  requestId: string,
  acceptingUserId: string,
): Promise<DisableUserResponse> {
  await getUserInOrganization(acceptingUserId, organizationId)

  const request = await prisma.userDisableRequest.findUnique({
    where: { id: requestId },
    include: { targetUser: true, requestedBy: true },
  })

  if (!request) {
    throw new AppError(404, 'Disable request not found')
  }

  if (request.targetUser.organizationId !== organizationId) {
    throw new AppError(404, 'Disable request not found')
  }

  if (request.status !== 'PENDING') {
    throw new AppError(400, 'This disable request is no longer pending')
  }

  if (request.targetUserId !== acceptingUserId) {
    throw new AppError(403, 'Only the target user can accept this disable request')
  }

  await ensureMinimumOneAdminAfterDisable(organizationId, request.targetUserId)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: request.targetUserId },
      data: { status: UserStatus.INACTIVE },
    }),
    prisma.userDisableRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', resolvedAt: new Date() },
    }),
    prisma.userDisableRequest.updateMany({
      where: {
        targetUserId: request.targetUserId,
        status: 'PENDING',
        id: { not: requestId },
      },
      data: { status: 'CANCELLED', resolvedAt: new Date() },
    }),
  ])

  return {
    disabled: true,
    message: 'Your account has been disabled. You will be signed out.',
  }
}

export async function rejectDisableRequest(
  organizationId: string,
  requestId: string,
  rejectingUserId: string,
): Promise<{ message: string }> {
  await getUserInOrganization(rejectingUserId, organizationId)

  const request = await prisma.userDisableRequest.findUnique({
    where: { id: requestId },
    include: { targetUser: true },
  })

  if (!request || request.targetUser.organizationId !== organizationId) {
    throw new AppError(404, 'Disable request not found')
  }

  if (request.status !== 'PENDING') {
    throw new AppError(400, 'This disable request is no longer pending')
  }

  if (request.targetUserId !== rejectingUserId) {
    throw new AppError(403, 'Only the target user can reject this disable request')
  }

  await prisma.userDisableRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', resolvedAt: new Date() },
  })

  return { message: 'Disable request rejected' }
}

export async function activateUser(organizationId: string, targetUserId: string): Promise<AuthUser> {
  const target = await getUserInOrganization(targetUserId, organizationId)

  if (target.status === UserStatus.ACTIVE) {
    throw new AppError(400, 'User is already active')
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { status: UserStatus.ACTIVE },
  })

  return reloadAuthUser(targetUserId)
}

export async function updateUserFeatures(
  organizationId: string,
  targetUserId: string,
  input: UpdateUserFeaturesInput,
): Promise<AuthUser> {
  const target = await getUserInOrganization(targetUserId, organizationId)
  const extraFeatures = computeExtraFeatures(target.role as UserRole, input.features)

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      extraFeatures: toPrismaFeatures(extraFeatures),
    },
  })

  return reloadAuthUser(targetUserId)
}

export async function updateUserRole(
  organizationId: string,
  targetUserId: string,
  actingUserId: string,
  input: UpdateUserRoleInput,
): Promise<AuthUser> {
  if (targetUserId === actingUserId) {
    throw new AppError(400, 'You cannot change your own role')
  }

  const target = await getUserInOrganization(targetUserId, organizationId)
  const newRole = input.role

  if (target.role === newRole) {
    throw new AppError(400, 'User already has this role')
  }

  const oldRole = target.role as UserRole

  if (oldRole === UserRole.ADMIN && newRole !== UserRole.ADMIN) {
    await ensureMinimumOneAdminAfterDisable(organizationId, targetUserId)
  }

  const extraFeatures = computeExtraFeatures(
    newRole,
    getEffectiveFeatures(oldRole, (target.extraFeatures ?? []) as AppFeature[]),
  )

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      role: newRole,
      extraFeatures: toPrismaFeatures(extraFeatures),
    },
  })

  return reloadAuthUser(targetUserId)
}
