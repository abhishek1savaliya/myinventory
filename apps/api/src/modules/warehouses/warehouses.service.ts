import type { Warehouse } from '@prisma/client'
import type {
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseDto,
  WarehouseListQuery,
} from '@myinventory/shared'
import { WarehouseStatus } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import { cacheGetOrSet, cacheTtl, invalidateCache, stableCacheSuffix } from '../../lib/cache.js'

function toWarehouseDto(warehouse: Warehouse): WarehouseDto {
  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    address: warehouse.address,
    status: warehouse.status as WarehouseStatus,
    createdAt: warehouse.createdAt.toISOString(),
    updatedAt: warehouse.updatedAt.toISOString(),
  }
}

export async function listWarehouses(organizationId: string, query: WarehouseListQuery) {
  return cacheGetOrSet(
    'warehouses',
    stableCacheSuffix('list', { organizationId, ...query }),
    cacheTtl.catalog,
    async () => {
      const where: {
        organizationId: string
        OR?: Array<{
          code?: { contains: string; mode: 'insensitive' }
          name?: { contains: string; mode: 'insensitive' }
        }>
        status?: WarehouseStatus
      } = { organizationId }

      if (query.search) {
        where.OR = [
          { code: { contains: query.search, mode: 'insensitive' } },
          { name: { contains: query.search, mode: 'insensitive' } },
        ]
      }

      if (query.status) {
        where.status = query.status
      }

      const skip = (query.page - 1) * query.pageSize

      const [warehouses, total] = await Promise.all([
        prisma.warehouse.findMany({
          where,
          orderBy: { code: 'asc' },
          skip,
          take: query.pageSize,
        }),
        prisma.warehouse.count({ where }),
      ])

      return {
        data: warehouses.map(toWarehouseDto),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
    },
  )
}

export async function getWarehouseById(organizationId: string, id: string): Promise<WarehouseDto> {
  return cacheGetOrSet(
    'warehouses',
    stableCacheSuffix('id', { organizationId, id }),
    cacheTtl.catalog,
    async () => {
      const warehouse = await prisma.warehouse.findFirst({ where: { id, organizationId } })

      if (!warehouse) {
        throw new AppError(404, 'Warehouse not found')
      }

      return toWarehouseDto(warehouse)
    },
  )
}

export async function createWarehouse(
  organizationId: string,
  input: CreateWarehouseInput,
): Promise<WarehouseDto> {
  try {
    const warehouse = await prisma.warehouse.create({
      data: {
        organizationId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        address: input.address?.trim() || null,
      },
    })

    await invalidateCache('warehouses')
    await invalidateCache('locations')
    await invalidateCache('inventory')

    return toWarehouseDto(warehouse)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'Warehouse code already exists')
    }
    throw error
  }
}

export async function updateWarehouse(
  organizationId: string,
  id: string,
  input: UpdateWarehouseInput,
): Promise<WarehouseDto> {
  await getWarehouseById(organizationId, id)

  try {
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        code: input.code?.trim().toUpperCase(),
        name: input.name?.trim(),
        address: input.address === undefined ? undefined : input.address?.trim() || null,
        status: input.status,
      },
    })

    await invalidateCache('warehouses')
    await invalidateCache('locations')
    await invalidateCache('inventory')

    return toWarehouseDto(warehouse)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'Warehouse code already exists')
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
