import { prisma } from '@myinventory/prisma'
import { invalidateUserAuthCache } from '../../lib/user-auth-cache.js'
import { AppError } from '../../middleware/error-handler.js'

type OrganizationSummaryRecord = {
  id: string
  orgCode: string
  slug: string
  name: string
  tradingName: string
  ownerName: string
  email: string
  contactNumber: string
  createdAt: Date
  _count: {
    users: number
    products: number
    warehouses: number
  }
  users: Array<{
    id: string
    status: string
  }>
}

function toOrganizationSummary(organization: OrganizationSummaryRecord) {
  const activeUsers = organization.users.filter((user) => user.status === 'ACTIVE').length
  const inactiveUsers = organization.users.length - activeUsers

  return {
    id: organization.id,
    orgCode: organization.orgCode,
    slug: organization.slug,
    name: organization.name,
    tradingName: organization.tradingName,
    ownerName: organization.ownerName,
    email: organization.email,
    contactNumber: organization.contactNumber,
    createdAt: organization.createdAt.toISOString(),
    totalUsers: organization._count.users,
    activeUsers,
    inactiveUsers,
    totalProducts: organization._count.products,
    totalWarehouses: organization._count.warehouses,
    isDisabled: activeUsers === 0,
  }
}

export async function listOrganizationsForSystemAdmin() {
  const organizations = await prisma.organization.findMany({
    select: {
      id: true,
      orgCode: true,
      slug: true,
      name: true,
      tradingName: true,
      ownerName: true,
      email: true,
      contactNumber: true,
      createdAt: true,
      users: {
        select: {
          id: true,
          status: true,
        },
      },
      _count: {
        select: {
          users: true,
          products: true,
          warehouses: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return organizations.map(toOrganizationSummary)
}

export async function getOrganizationDetailsForSystemAdmin(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      orgCode: true,
      slug: true,
      name: true,
      tradingName: true,
      ownerName: true,
      email: true,
      contactNumber: true,
      logoUrl: true,
      loginBackgroundUrl: true,
      themeColor: true,
      createdAt: true,
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      _count: {
        select: {
          users: true,
          products: true,
          warehouses: true,
          chatGroups: true,
          chatMessages: true,
        },
      },
      products: {
        select: {
          id: true,
        },
        take: 1,
      },
      warehouses: {
        select: {
          id: true,
          locations: {
            select: {
              id: true,
            },
          },
        },
      },
      chatMessages: {
        select: {
          id: true,
        },
        take: 1,
      },
    },
  })

  if (!organization) {
    throw new AppError(404, 'Organization not found')
  }

  const activeUsers = organization.users.filter((user) => user.status === 'ACTIVE').length
  const inactiveUsers = organization.users.length - activeUsers
  const totalLocations = organization.warehouses.reduce(
    (count, warehouse) => count + warehouse.locations.length,
    0,
  )

  return {
    id: organization.id,
    orgCode: organization.orgCode,
    slug: organization.slug,
    name: organization.name,
    tradingName: organization.tradingName,
    ownerName: organization.ownerName,
    email: organization.email,
    contactNumber: organization.contactNumber,
    logoUrl: organization.logoUrl,
    loginBackgroundUrl: organization.loginBackgroundUrl,
    themeColor: organization.themeColor,
    createdAt: organization.createdAt.toISOString(),
    totalUsers: organization._count.users,
    activeUsers,
    inactiveUsers,
    totalProducts: organization._count.products,
    totalWarehouses: organization._count.warehouses,
    totalLocations,
    totalChatGroups: organization._count.chatGroups,
    totalChatMessages: organization._count.chatMessages,
    isDisabled: activeUsers === 0,
    users: organization.users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
  }
}

export async function disableOrganizationForSystemAdmin(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      users: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  })

  if (!organization) {
    throw new AppError(404, 'Organization not found')
  }

  const activeUserIds = organization.users
    .filter((user) => user.status === 'ACTIVE')
    .map((user) => user.id)

  if (activeUserIds.length > 0) {
    await prisma.user.updateMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      data: {
        status: 'INACTIVE',
      },
    })

    await Promise.all(activeUserIds.map((userId) => invalidateUserAuthCache(userId)))
  }

  const refreshed = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      orgCode: true,
      slug: true,
      name: true,
      tradingName: true,
      ownerName: true,
      email: true,
      contactNumber: true,
      createdAt: true,
      users: {
        select: {
          id: true,
          status: true,
        },
      },
      _count: {
        select: {
          users: true,
          products: true,
          warehouses: true,
        },
      },
    },
  })

  if (!refreshed) {
    throw new AppError(404, 'Organization not found')
  }

  return {
    organization: toOrganizationSummary(refreshed),
    message:
      activeUserIds.length > 0
        ? `${organization.name} has been disabled`
        : `${organization.name} is already disabled`,
  }
}

export async function enableOrganizationForSystemAdmin(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      users: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  })

  if (!organization) {
    throw new AppError(404, 'Organization not found')
  }

  const inactiveUserIds = organization.users
    .filter((user) => user.status === 'INACTIVE')
    .map((user) => user.id)

  if (inactiveUserIds.length > 0) {
    await prisma.user.updateMany({
      where: {
        organizationId,
        status: 'INACTIVE',
      },
      data: {
        status: 'ACTIVE',
      },
    })

    await Promise.all(inactiveUserIds.map((userId) => invalidateUserAuthCache(userId)))
  }

  const refreshed = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      orgCode: true,
      slug: true,
      name: true,
      tradingName: true,
      ownerName: true,
      email: true,
      contactNumber: true,
      createdAt: true,
      users: {
        select: {
          id: true,
          status: true,
        },
      },
      _count: {
        select: {
          users: true,
          products: true,
          warehouses: true,
        },
      },
    },
  })

  if (!refreshed) {
    throw new AppError(404, 'Organization not found')
  }

  return {
    organization: toOrganizationSummary(refreshed),
    message:
      inactiveUserIds.length > 0
        ? `${organization.name} has been enabled`
        : `${organization.name} is already enabled`,
  }
}
