import type { User, UserDisableRequest } from '@prisma/client'
import type {
  AuthUser,
  CreateUserInput,
  DisableUserResponse,
  UpdateUserFeaturesInput,
  UserDisableRequestDto,
} from '@myinventory/shared'
import { UserRole, UserStatus, computeExtraFeatures } from '@myinventory/shared'
import bcrypt from 'bcryptjs'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import { mapUserToAuthUser, toPrismaFeatures } from './user.mapper.js'

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

async function countActiveAdmins(excludeUserId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  })
}

async function ensureMinimumOneAdminAfterDisable(targetUserId: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } })

  if (!target || target.role !== UserRole.ADMIN) {
    return
  }

  const remaining = await countActiveAdmins(targetUserId)

  if (remaining < 1) {
    throw new AppError(400, 'At least one active admin must remain in the system')
  }
}

export async function createUser(input: CreateUserInput): Promise<AuthUser> {
  const email = input.email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    throw new AppError(409, 'A user with this email already exists')
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        role: input.role,
      },
    })

    return mapUserToAuthUser(user)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError(409, 'A user with this email already exists')
    }
    throw error
  }
}

export async function requestDisableUser(
  targetUserId: string,
  requestedById: string,
): Promise<DisableUserResponse> {
  if (targetUserId === requestedById) {
    throw new AppError(400, 'You cannot disable your own account')
  }

  const [target, requester] = await Promise.all([
    prisma.user.findUnique({ where: { id: targetUserId } }),
    prisma.user.findUnique({ where: { id: requestedById } }),
  ])

  if (!target) {
    throw new AppError(404, 'User not found')
  }

  if (target.status !== UserStatus.ACTIVE) {
    throw new AppError(400, 'User is already inactive')
  }

  if (!requester || requester.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can disable users')
  }

  await ensureMinimumOneAdminAfterDisable(targetUserId)

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
  userId: string,
): Promise<UserDisableRequestDto[]> {
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
  requestId: string,
  acceptingUserId: string,
): Promise<DisableUserResponse> {
  const request = await prisma.userDisableRequest.findUnique({
    where: { id: requestId },
    include: { targetUser: true, requestedBy: true },
  })

  if (!request) {
    throw new AppError(404, 'Disable request not found')
  }

  if (request.status !== 'PENDING') {
    throw new AppError(400, 'This disable request is no longer pending')
  }

  if (request.targetUserId !== acceptingUserId) {
    throw new AppError(403, 'Only the target user can accept this disable request')
  }

  await ensureMinimumOneAdminAfterDisable(request.targetUserId)

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
  requestId: string,
  rejectingUserId: string,
): Promise<{ message: string }> {
  const request = await prisma.userDisableRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
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

export async function activateUser(targetUserId: string): Promise<AuthUser> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } })

  if (!target) {
    throw new AppError(404, 'User not found')
  }

  if (target.status === UserStatus.ACTIVE) {
    throw new AppError(400, 'User is already active')
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { status: UserStatus.ACTIVE },
  })

  return mapUserToAuthUser(user)
}

export async function updateUserFeatures(
  targetUserId: string,
  input: UpdateUserFeaturesInput,
): Promise<AuthUser> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } })

  if (!target) {
    throw new AppError(404, 'User not found')
  }

  const extraFeatures = computeExtraFeatures(target.role as UserRole, input.features)

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      extraFeatures: toPrismaFeatures(extraFeatures),
    },
  })

  return mapUserToAuthUser(user)
}
