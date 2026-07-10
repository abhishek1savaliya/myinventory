import type { User } from '@prisma/client'
import type { AppFeature as PrismaAppFeature } from '@prisma/client'
import type { AuthUser } from '@myinventory/shared'
import {
  AppFeature,
  UserRole,
  UserStatus,
  getEffectiveFeatures,
} from '@myinventory/shared'
import { mapOrganizationToSummary } from '../organizations/organization.mapper.js'

type UserWithOrganization = User & {
  organization: {
    id: string
    orgCode: string
    slug: string
    name: string
    tradingName: string
  }
}

export function mapUserToAuthUser(user: UserWithOrganization): AuthUser {
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
    organization: mapOrganizationToSummary(user.organization),
  }
}

export function toPrismaFeatures(features: AppFeature[]): PrismaAppFeature[] {
  return features as PrismaAppFeature[]
}

export const userWithOrganizationInclude = {
  organization: {
    select: {
      id: true,
      orgCode: true,
      slug: true,
      name: true,
      tradingName: true,
    },
  },
} as const
