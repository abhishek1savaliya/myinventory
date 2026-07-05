import type { AppFeature, UserRole } from '@myinventory/shared'
import { getEffectiveFeatures } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'

export async function getUserFeaturesById(userId: string): Promise<AppFeature[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, extraFeatures: true },
  })

  if (!user) {
    return []
  }

  return getEffectiveFeatures(user.role as UserRole, user.extraFeatures as AppFeature[])
}
