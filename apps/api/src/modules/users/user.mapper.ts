import type { User } from '@prisma/client'
import type { AppFeature as PrismaAppFeature } from '@prisma/client'
import type { AuthUser } from '@myinventory/shared'
import {
  AppFeature,
  UserRole,
  UserStatus,
  getEffectiveFeatures,
} from '@myinventory/shared'

export function mapUserToAuthUser(user: User): AuthUser {
  const extraFeatures = (user.extraFeatures ?? []) as AppFeature[]

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    createdAt: user.createdAt.toISOString(),
    extraFeatures,
    features: getEffectiveFeatures(user.role as UserRole, extraFeatures),
  }
}

export function toPrismaFeatures(features: AppFeature[]): PrismaAppFeature[] {
  return features as PrismaAppFeature[]
}
