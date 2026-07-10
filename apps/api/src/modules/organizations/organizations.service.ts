import type { OrganizationPublicProfile, OrganizationSignupInput, OrganizationSignupResponse } from '@myinventory/shared'
import {
  UserRole,
  buildOrgCode,
  randomOrgCodeSuffix,
  slugifyOrganizationName,
} from '@myinventory/shared'
import bcrypt from 'bcryptjs'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import { mapOrganizationToSummary } from './organization.mapper.js'

async function generateUniqueOrgCode(name: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const orgCode = buildOrgCode(name, randomOrgCodeSuffix())
    const existing = await prisma.organization.findUnique({ where: { orgCode } })
    if (!existing) {
      return orgCode
    }
  }

  throw new AppError(500, 'Could not generate a unique organization ID. Please try again.')
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugifyOrganizationName(name) || 'organization'

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`
    const existing = await prisma.organization.findUnique({ where: { slug } })
    if (!existing) {
      return slug
    }
  }

  throw new AppError(500, 'Could not generate a unique organization URL. Please try again.')
}

export async function signupOrganization(
  input: OrganizationSignupInput,
): Promise<OrganizationSignupResponse> {
  const email = input.email.toLowerCase().trim()
  const orgCode = await generateUniqueOrgCode(input.name)
  const slug = await generateUniqueSlug(input.name)
  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          orgCode,
          name: input.name.trim(),
          tradingName: input.tradingName.trim(),
          ownerName: input.ownerName.trim(),
          email,
          contactNumber: input.contactNumber.trim(),
          slug,
        },
      })

      await tx.user.create({
        data: {
          organizationId: organization.id,
          name: input.ownerName.trim(),
          email,
          passwordHash,
          role: UserRole.ADMIN,
        },
      })

      return organization
    })

    return {
      organization: mapOrganizationToSummary(result),
      orgCode: result.orgCode,
      slug: result.slug,
      ownerEmail: email,
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError(409, 'An organization with this email or name already exists')
    }
    throw error
  }
}

export async function getOrganizationPublicProfile(slug: string): Promise<OrganizationPublicProfile> {
  const organization = await prisma.organization.findUnique({
    where: { slug: slug.toLowerCase().trim() },
    select: { slug: true, name: true, tradingName: true },
  })

  if (!organization) {
    throw new AppError(404, 'Organization not found')
  }

  return organization
}

export async function findOrganizationByOrgCode(orgCode: string) {
  return prisma.organization.findUnique({
    where: { orgCode: orgCode.toUpperCase().trim() },
  })
}
