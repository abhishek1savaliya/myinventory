import type { Prisma } from '@prisma/client'
import type { InventoryTransactionDto, TransactionListQuery } from '@myinventory/shared'
import { AdjustmentReason, TransactionType } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'

type TransactionWithRelations = Prisma.InventoryTransactionGetPayload<{
  include: {
    product: { select: { name: true } }
    user: { select: { name: true } }
    sourceWarehouse: { select: { code: true } }
    sourceLocation: { select: { code: true } }
    destinationWarehouse: { select: { code: true } }
    destinationLocation: { select: { code: true } }
  }
}>

function toTransactionDto(record: TransactionWithRelations): InventoryTransactionDto {
  return {
    id: record.id,
    type: record.type as TransactionType,
    productId: record.productId,
    sku: record.sku,
    productName: record.product.name,
    quantity: record.quantity,
    sourceWarehouseCode: record.sourceWarehouse?.code ?? null,
    sourceLocationCode: record.sourceLocation?.code ?? null,
    destinationWarehouseCode: record.destinationWarehouse?.code ?? null,
    destinationLocationCode: record.destinationLocation?.code ?? null,
    userId: record.userId,
    userName: record.user.name,
    reference: record.reference,
    notes: record.notes,
    adjustmentReason: record.adjustmentReason as AdjustmentReason | null,
    createdAt: record.createdAt.toISOString(),
  }
}

const transactionInclude = {
  product: { select: { name: true } },
  user: { select: { name: true } },
  sourceWarehouse: { select: { code: true } },
  sourceLocation: { select: { code: true } },
  destinationWarehouse: { select: { code: true } },
  destinationLocation: { select: { code: true } },
} as const

export async function listTransactions(query: TransactionListQuery) {
  const where: Prisma.InventoryTransactionWhereInput = {}

  if (query.transactionId) where.id = query.transactionId
  if (query.sku) where.sku = { contains: query.sku, mode: 'insensitive' }
  if (query.productId) where.productId = query.productId
  if (query.userId) where.userId = query.userId

  if (query.type) {
    where.type = query.type as TransactionType
  }

  if (query.warehouseId || query.locationId) {
    const andConditions: Prisma.InventoryTransactionWhereInput[] = []

    if (query.warehouseId) {
      andConditions.push({
        OR: [
          { sourceWarehouseId: query.warehouseId },
          { destinationWarehouseId: query.warehouseId },
        ],
      })
    }

    if (query.locationId) {
      andConditions.push({
        OR: [
          { sourceLocationId: query.locationId },
          { destinationLocationId: query.locationId },
        ],
      })
    }

    where.AND = andConditions
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    }
  }

  const skip = (query.page - 1) * query.pageSize

  const [records, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      include: transactionInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.pageSize,
    }),
    prisma.inventoryTransaction.count({ where }),
  ])

  return {
    data: records.map(toTransactionDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function getTransactionById(id: string): Promise<InventoryTransactionDto> {
  const record = await prisma.inventoryTransaction.findUnique({
    where: { id },
    include: transactionInclude,
  })

  if (!record) {
    throw new AppError(404, 'Transaction not found')
  }

  return toTransactionDto(record)
}
