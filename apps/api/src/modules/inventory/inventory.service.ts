import type { Prisma } from '@prisma/client'
import type { PrismaTransactionClient } from '@myinventory/prisma'
import type {
  AdjustStockInput,
  InventoryItemDto,
  InventoryListQuery,
  MoveStockInput,
  MoveStockResult,
  PickStockInput,
  ReceiveStockInput,
  ReturnStockInput,
  StockOperationResult,
} from '@myinventory/shared'
import { ProductStatus, TransactionType, UserRole } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import { cacheGetOrSet, cacheTtl, invalidateCache, stableCacheSuffix } from '../../lib/cache.js'
import {
  getInventoryRecordById,
  inventoryInclude,
  lockInventoryRow,
  resolveDeviceRecordId,
  toInventoryItemDto,
} from './inventory.helpers.js'
import { createInventoryLedgerEntry, formatLedgerLog } from './ledger.service.js'

type LockedInventoryRow = {
  id: string
  product_id: string
  warehouse_id: string
  location_id: string
  quantity: number
  reserved_quantity: number
}

async function validateProduct(tx: PrismaTransactionClient, productId: string) {
  const product = await tx.product.findUnique({ where: { id: productId } })

  if (!product) {
    throw new AppError(404, 'Product not found')
  }

  if (product.status !== ProductStatus.ACTIVE) {
    throw new AppError(400, 'Product is disabled and cannot be used in stock operations')
  }

  return product
}

async function validateLocationInWarehouse(
  tx: PrismaTransactionClient,
  warehouseId: string,
  locationId: string,
) {
  const location = await tx.location.findFirst({
    where: { id: locationId, warehouseId },
    include: { warehouse: true },
  })

  if (!location) {
    throw new AppError(404, 'Location not found in the selected warehouse')
  }

  return location
}

async function ensureInventoryRow(
  tx: PrismaTransactionClient,
  productId: string,
  warehouseId: string,
  locationId: string,
): Promise<LockedInventoryRow> {
  let row = await lockInventoryRow(tx, productId, warehouseId, locationId)

  if (!row) {
    await tx.inventory.create({
      data: { productId, warehouseId, locationId, quantity: 0, reservedQuantity: 0 },
    })
    row = await lockInventoryRow(tx, productId, warehouseId, locationId)
  }

  if (!row) {
    throw new AppError(500, 'Failed to initialize inventory record')
  }

  return row
}

function getAvailableQuantity(row: LockedInventoryRow): number {
  return row.quantity - row.reserved_quantity
}

async function invalidateInventoryCache(): Promise<void> {
  await invalidateCache('inventory')
}

export async function listInventory(query: InventoryListQuery) {
  return cacheGetOrSet(
    'inventory',
    stableCacheSuffix('list', query),
    cacheTtl.inventory,
    async () => {
      const where: Prisma.InventoryWhereInput = {}

      if (query.productId) where.productId = query.productId
      if (query.warehouseId) where.warehouseId = query.warehouseId
      if (query.locationId) where.locationId = query.locationId

      if (query.sku || query.barcode || query.search) {
        where.product = {
          ...(query.sku ? { sku: { contains: query.sku, mode: 'insensitive' } } : {}),
          ...(query.barcode ? { barcode: { contains: query.barcode, mode: 'insensitive' } } : {}),
          ...(query.search
            ? {
                OR: [
                  { sku: { contains: query.search, mode: 'insensitive' } },
                  { barcode: { contains: query.search, mode: 'insensitive' } },
                  { name: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        }
      }

      const skip = (query.page - 1) * query.pageSize

      const [records, total] = await Promise.all([
        prisma.inventory.findMany({
          where,
          include: inventoryInclude,
          orderBy: [{ warehouse: { code: 'asc' } }, { location: { code: 'asc' } }],
          skip,
          take: query.pageSize,
        }),
        prisma.inventory.count({ where }),
      ])

      return {
        data: records.map(toInventoryItemDto),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
    },
  )
}

export async function getInventoryByProduct(productId: string): Promise<InventoryItemDto[]> {
  return cacheGetOrSet(
    'inventory',
    stableCacheSuffix('product', { productId }),
    cacheTtl.inventory,
    async () => {
      const product = await prisma.product.findUnique({ where: { id: productId } })

      if (!product) {
        throw new AppError(404, 'Product not found')
      }

      const records = await prisma.inventory.findMany({
        where: { productId },
        include: inventoryInclude,
        orderBy: [{ warehouse: { code: 'asc' } }, { location: { code: 'asc' } }],
      })

      return records.map(toInventoryItemDto)
    },
  )
}

export async function receiveStock(
  input: ReceiveStockInput,
  userId: string,
): Promise<StockOperationResult> {
  return prisma.$transaction(async (tx) => {
    const product = await validateProduct(tx, input.productId)
    await validateLocationInWarehouse(tx, input.warehouseId, input.locationId)

    const row = await ensureInventoryRow(
      tx,
      input.productId,
      input.warehouseId,
      input.locationId,
    )

    const newQuantity = row.quantity + input.quantity

    await tx.inventory.update({
      where: { id: row.id },
      data: { quantity: newQuantity },
    })

    const deviceRecordId = await resolveDeviceRecordId(tx, input.deviceId, userId)

    const transaction = await createInventoryLedgerEntry(tx, {
      type: TransactionType.STOCK_RECEIVED,
      productId: product.id,
      sku: product.sku,
      quantity: input.quantity,
      destinationWarehouseId: input.warehouseId,
      destinationLocationId: input.locationId,
      userId,
      deviceRecordId,
      reference: input.reference,
      notes: input.notes,
    })

    console.log(formatLedgerLog(transaction))

    const inventory = await getInventoryRecordById(tx, row.id)

    await invalidateInventoryCache()

    return { transactionId: transaction.id, inventory }
  })
}

export async function returnStock(
  input: ReturnStockInput,
  userId: string,
): Promise<StockOperationResult> {
  return prisma.$transaction(async (tx) => {
    const product = await validateProduct(tx, input.productId)
    await validateLocationInWarehouse(tx, input.warehouseId, input.locationId)

    const row = await ensureInventoryRow(
      tx,
      input.productId,
      input.warehouseId,
      input.locationId,
    )

    await tx.inventory.update({
      where: { id: row.id },
      data: { quantity: row.quantity + input.quantity },
    })

    const deviceRecordId = await resolveDeviceRecordId(tx, input.deviceId, userId)

    const transaction = await createInventoryLedgerEntry(tx, {
      type: TransactionType.STOCK_RETURNED,
      productId: product.id,
      sku: product.sku,
      quantity: input.quantity,
      destinationWarehouseId: input.warehouseId,
      destinationLocationId: input.locationId,
      userId,
      deviceRecordId,
      reference: input.reference,
      notes: input.notes,
    })

    console.log(formatLedgerLog(transaction))

    const inventory = await getInventoryRecordById(tx, row.id)

    await invalidateInventoryCache()

    return { transactionId: transaction.id, inventory }
  })
}

export async function moveStock(
  input: MoveStockInput,
  userId: string,
): Promise<MoveStockResult> {
  if (
    input.sourceWarehouseId === input.destinationWarehouseId &&
    input.sourceLocationId === input.destinationLocationId
  ) {
    throw new AppError(400, 'Source and destination locations must be different')
  }

  return prisma.$transaction(async (tx) => {
    const product = await validateProduct(tx, input.productId)
    await validateLocationInWarehouse(tx, input.sourceWarehouseId, input.sourceLocationId)
    await validateLocationInWarehouse(
      tx,
      input.destinationWarehouseId,
      input.destinationLocationId,
    )

    const sourceRow = await lockInventoryRow(
      tx,
      input.productId,
      input.sourceWarehouseId,
      input.sourceLocationId,
    )

    if (!sourceRow) {
      throw new AppError(400, 'No inventory at source location')
    }

    if (getAvailableQuantity(sourceRow) < input.quantity) {
      throw new AppError(400, 'Insufficient available inventory at source location')
    }

    const destRow = await ensureInventoryRow(
      tx,
      input.productId,
      input.destinationWarehouseId,
      input.destinationLocationId,
    )

    await tx.inventory.update({
      where: { id: sourceRow.id },
      data: { quantity: sourceRow.quantity - input.quantity },
    })

    await tx.inventory.update({
      where: { id: destRow.id },
      data: { quantity: destRow.quantity + input.quantity },
    })

    const deviceRecordId = await resolveDeviceRecordId(tx, input.deviceId, userId)

    const transaction = await createInventoryLedgerEntry(tx, {
      type: TransactionType.STOCK_MOVED,
      productId: product.id,
      sku: product.sku,
      quantity: input.quantity,
      sourceWarehouseId: input.sourceWarehouseId,
      sourceLocationId: input.sourceLocationId,
      destinationWarehouseId: input.destinationWarehouseId,
      destinationLocationId: input.destinationLocationId,
      userId,
      deviceRecordId,
      reference: input.reference,
      notes: input.notes,
    })

    console.log(formatLedgerLog(transaction))

    const sourceInventory = await getInventoryRecordById(tx, sourceRow.id)
    const destinationInventory = await getInventoryRecordById(tx, destRow.id)

    await invalidateInventoryCache()

    return {
      transactionId: transaction.id,
      sourceInventory,
      destinationInventory,
    }
  })
}

export async function pickStock(
  input: PickStockInput,
  userId: string,
): Promise<StockOperationResult> {
  return prisma.$transaction(async (tx) => {
    const product = await validateProduct(tx, input.productId)
    await validateLocationInWarehouse(tx, input.warehouseId, input.locationId)

    const row = await lockInventoryRow(
      tx,
      input.productId,
      input.warehouseId,
      input.locationId,
    )

    if (!row) {
      throw new AppError(400, 'No inventory at selected location')
    }

    if (getAvailableQuantity(row) < input.quantity) {
      throw new AppError(400, 'Insufficient available inventory to pick')
    }

    await tx.inventory.update({
      where: { id: row.id },
      data: { quantity: row.quantity - input.quantity },
    })

    const deviceRecordId = await resolveDeviceRecordId(tx, input.deviceId, userId)

    const transaction = await createInventoryLedgerEntry(tx, {
      type: TransactionType.STOCK_PICKED,
      productId: product.id,
      sku: product.sku,
      quantity: input.quantity,
      sourceWarehouseId: input.warehouseId,
      sourceLocationId: input.locationId,
      userId,
      deviceRecordId,
      reference: input.reference,
      notes: input.notes,
    })

    console.log(formatLedgerLog(transaction))

    const inventory = await getInventoryRecordById(tx, row.id)

    await invalidateInventoryCache()

    return { transactionId: transaction.id, inventory }
  })
}

export async function adjustStock(
  input: AdjustStockInput,
  userId: string,
  userRole: UserRole,
): Promise<StockOperationResult> {
  return prisma.$transaction(async (tx) => {
    const product = await validateProduct(tx, input.productId)
    await validateLocationInWarehouse(tx, input.warehouseId, input.locationId)

    const row = await ensureInventoryRow(
      tx,
      input.productId,
      input.warehouseId,
      input.locationId,
    )

    const newQuantity = row.quantity + input.quantityDelta

    if (newQuantity < 0) {
      const canAllowNegative = input.allowNegative && userRole === UserRole.ADMIN

      if (!canAllowNegative) {
        throw new AppError(
          400,
          'Adjustment would result in negative inventory. Only an admin can authorise negative stock.',
        )
      }
    }

    if (input.quantityDelta < 0 && getAvailableQuantity(row) < Math.abs(input.quantityDelta)) {
      const canAllowNegative = input.allowNegative && userRole === UserRole.ADMIN

      if (!canAllowNegative) {
        throw new AppError(400, 'Insufficient available inventory for this adjustment')
      }
    }

    await tx.inventory.update({
      where: { id: row.id },
      data: { quantity: newQuantity },
    })

    const deviceRecordId = await resolveDeviceRecordId(tx, input.deviceId, userId)

    const transaction = await createInventoryLedgerEntry(tx, {
      type: TransactionType.STOCK_ADJUSTED,
      productId: product.id,
      sku: product.sku,
      quantity: Math.abs(input.quantityDelta),
      sourceWarehouseId: input.quantityDelta < 0 ? input.warehouseId : null,
      sourceLocationId: input.quantityDelta < 0 ? input.locationId : null,
      destinationWarehouseId: input.quantityDelta > 0 ? input.warehouseId : null,
      destinationLocationId: input.quantityDelta > 0 ? input.locationId : null,
      userId,
      deviceRecordId,
      reference: input.reference,
      notes: input.notes,
      adjustmentReason: input.adjustmentReason,
    })

    console.log(formatLedgerLog(transaction))

    const inventory = await getInventoryRecordById(tx, row.id)

    await invalidateInventoryCache()

    return { transactionId: transaction.id, inventory }
  })
}
