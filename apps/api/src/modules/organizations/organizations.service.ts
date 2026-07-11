import type {
  OrganizationBranding,
  OrganizationBrandingUpdateInput,
  OrganizationPublicProfile,
  OrganizationSignupInput,
  OrganizationSignupResponse,
} from '@myinventory/shared'
import {
  UserRole,
  buildOrgCode,
  randomOrgCodeSuffix,
  slugifyOrganizationName,
} from '@myinventory/shared'
import bcrypt from 'bcryptjs'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import {
  deleteOrgBrandingFromUrls,
  uploadOrgBrandingImageFromBase64,
} from '../../lib/org-branding.js'
import { mapOrganizationToPublicProfile, mapOrganizationToSummary } from './organization.mapper.js'

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
    select: {
      slug: true,
      name: true,
      tradingName: true,
      logoUrl: true,
      loginBackgroundUrl: true,
      themeColor: true,
    },
  })

  if (!organization) {
    throw new AppError(404, 'Organization not found')
  }

  return mapOrganizationToPublicProfile(organization)
}

export async function updateOrganizationBranding(
  organizationId: string,
  ownerEmail: string,
  input: OrganizationBrandingUpdateInput,
): Promise<OrganizationBranding> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      email: true,
      logoUrl: true,
      loginBackgroundUrl: true,
      themeColor: true,
    },
  })

  if (!organization) {
    throw new AppError(404, 'Organization not found')
  }

  if (organization.email.toLowerCase() !== ownerEmail.toLowerCase().trim()) {
    throw new AppError(403, 'Only the organization owner can customize the login page')
  }

  let logoUrl = organization.logoUrl
  let loginBackgroundUrl = organization.loginBackgroundUrl
  let themeColor = organization.themeColor

  if (input.removeLogo && logoUrl) {
    await deleteOrgBrandingFromUrls([logoUrl])
    logoUrl = null
  }

  if (input.removeLoginBackground && loginBackgroundUrl) {
    await deleteOrgBrandingFromUrls([loginBackgroundUrl])
    loginBackgroundUrl = null
  }

  if (input.logoBase64) {
    if (logoUrl) {
      await deleteOrgBrandingFromUrls([logoUrl])
    }
    logoUrl = await uploadOrgBrandingImageFromBase64(organizationId, 'logo', input.logoBase64)
  }

  if (input.loginBackgroundBase64) {
    if (loginBackgroundUrl) {
      await deleteOrgBrandingFromUrls([loginBackgroundUrl])
    }
    loginBackgroundUrl = await uploadOrgBrandingImageFromBase64(
      organizationId,
      'background',
      input.loginBackgroundBase64,
    )
  }

  if (input.themeColor !== undefined) {
    themeColor = input.themeColor
  }

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      logoUrl,
      loginBackgroundUrl,
      themeColor,
    },
    select: {
      logoUrl: true,
      loginBackgroundUrl: true,
      themeColor: true,
    },
  })

  return updated
}

export async function findOrganizationByOrgCode(orgCode: string) {
  return prisma.organization.findUnique({
    where: { orgCode: orgCode.toUpperCase().trim() },
  })
}

export async function searchOrganizations(query: string) {
  const q = query.trim()
  if (q.length < 2) {
    return []
  }

  const lower = q.toLowerCase()
  const upper = q.toUpperCase()

  const organizations = await prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { tradingName: { contains: q, mode: 'insensitive' } },
        { slug: { contains: lower } },
        { orgCode: { startsWith: upper } },
      ],
    },
    select: {
      slug: true,
      name: true,
      tradingName: true,
      orgCode: true,
      logoUrl: true,
      themeColor: true,
    },
    orderBy: [{ tradingName: 'asc' }],
    take: 20,
  })

  return organizations
}
