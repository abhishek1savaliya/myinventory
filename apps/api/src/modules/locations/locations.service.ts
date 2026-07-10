import type { Location } from '@prisma/client'
import type {
  CreateLocationInput,
  LocationDto,
  LocationListQuery,
  UpdateLocationInput,
} from '@myinventory/shared'
import { LocationStatus } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import { cacheGetOrSet, cacheTtl, invalidateCache, stableCacheSuffix } from '../../lib/cache.js'

type LocationWithWarehouse = Location & {
  warehouse: { code: string; name: string }
}

function toLocationDto(location: LocationWithWarehouse): LocationDto {
  return {
    id: location.id,
    warehouseId: location.warehouseId,
    warehouseCode: location.warehouse.code,
    warehouseName: location.warehouse.name,
    code: location.code,
    zone: location.zone,
    aisle: location.aisle,
    rack: location.rack,
    shelf: location.shelf,
    bin: location.bin,
    status: location.status as LocationStatus,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString(),
  }
}

const locationInclude = {
  warehouse: {
    select: { code: true, name: true },
  },
} as const

export async function listLocations(organizationId: string, query: LocationListQuery) {
  return cacheGetOrSet(
    'locations',
    stableCacheSuffix('list', { organizationId, ...query }),
    cacheTtl.catalog,
    async () => {
      const where: {
        warehouse: { organizationId: string }
        OR?: Array<{
          code?: { contains: string; mode: 'insensitive' }
          zone?: { contains: string; mode: 'insensitive' }
        }>
        warehouseId?: string
        status?: LocationStatus
      } = {
        warehouse: { organizationId },
      }

      if (query.search) {
        where.OR = [
          { code: { contains: query.search, mode: 'insensitive' } },
          { zone: { contains: query.search, mode: 'insensitive' } },
        ]
      }

      if (query.warehouseId) {
        where.warehouseId = query.warehouseId
      }

      if (query.status) {
        where.status = query.status
      }

      const skip = (query.page - 1) * query.pageSize

      const [locations, total] = await Promise.all([
        prisma.location.findMany({
          where,
          include: locationInclude,
          orderBy: [{ warehouse: { code: 'asc' } }, { code: 'asc' }],
          skip,
          take: query.pageSize,
        }),
        prisma.location.count({ where }),
      ])

      return {
        data: locations.map(toLocationDto),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
    },
  )
}

export async function getLocationById(organizationId: string, id: string): Promise<LocationDto> {
  return cacheGetOrSet(
    'locations',
    stableCacheSuffix('id', { organizationId, id }),
    cacheTtl.catalog,
    async () => {
      const location = await prisma.location.findFirst({
        where: { id, warehouse: { organizationId } },
        include: locationInclude,
      })

      if (!location) {
        throw new AppError(404, 'Location not found')
      }

      return toLocationDto(location)
    },
  )
}

export async function createLocation(
  organizationId: string,
  input: CreateLocationInput,
): Promise<LocationDto> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, organizationId },
  })

  if (!warehouse) {
    throw new AppError(404, 'Warehouse not found')
  }

  try {
    const location = await prisma.location.create({
      data: {
        warehouseId: input.warehouseId,
        code: input.code.trim().toUpperCase(),
        zone: input.zone?.trim() || null,
        aisle: input.aisle?.trim() || null,
        rack: input.rack?.trim() || null,
        shelf: input.shelf?.trim() || null,
        bin: input.bin?.trim() || null,
      },
      include: locationInclude,
    })

    await invalidateCache('locations')
    await invalidateCache('inventory')

    return toLocationDto(location)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'Location code already exists in this warehouse')
    }
    throw error
  }
}

export async function updateLocation(
  organizationId: string,
  id: string,
  input: UpdateLocationInput,
): Promise<LocationDto> {
  await getLocationById(organizationId, id)

  try {
    const location = await prisma.location.update({
      where: { id },
      data: {
        code: input.code?.trim().toUpperCase(),
        zone: input.zone === undefined ? undefined : input.zone?.trim() || null,
        aisle: input.aisle === undefined ? undefined : input.aisle?.trim() || null,
        rack: input.rack === undefined ? undefined : input.rack?.trim() || null,
        shelf: input.shelf === undefined ? undefined : input.shelf?.trim() || null,
        bin: input.bin === undefined ? undefined : input.bin?.trim() || null,
        status: input.status,
      },
      include: locationInclude,
    })

    await invalidateCache('locations')
    await invalidateCache('inventory')

    return toLocationDto(location)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'Location code already exists in this warehouse')
    }
    throw error
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}
