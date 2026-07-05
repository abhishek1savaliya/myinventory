import type { Prisma } from '@prisma/client'
import type { PrismaTransactionClient } from '@myinventory/prisma'
import type { InventoryItemDto } from '@myinventory/shared'

type InventoryWithRelations = Prisma.InventoryGetPayload<{
  include: {
    product: { select: { sku: true; barcode: true; name: true } }
    warehouse: { select: { code: true; name: true } }
    location: { select: { code: true } }
  }
}>

export function toInventoryItemDto(record: InventoryWithRelations): InventoryItemDto {
  return {
    id: record.id,
    productId: record.productId,
    sku: record.product.sku,
    barcode: record.product.barcode,
    productName: record.product.name,
    warehouseId: record.warehouseId,
    warehouseCode: record.warehouse.code,
    warehouseName: record.warehouse.name,
    locationId: record.locationId,
    locationCode: record.location.code,
    quantity: record.quantity,
    reservedQuantity: record.reservedQuantity,
    availableQuantity: record.quantity - record.reservedQuantity,
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const inventoryInclude = {
  product: { select: { sku: true, barcode: true, name: true } },
  warehouse: { select: { code: true, name: true } },
  location: { select: { code: true } },
} as const

interface LockedInventoryRow {
  id: string
  product_id: string
  warehouse_id: string
  location_id: string
  quantity: number
  reserved_quantity: number
}

export async function lockInventoryRow(
  tx: PrismaTransactionClient,
  productId: string,
  warehouseId: string,
  locationId: string,
): Promise<LockedInventoryRow | null> {
  const rows = await tx.$queryRaw<LockedInventoryRow[]>`
    SELECT id, product_id, warehouse_id, location_id, quantity, reserved_quantity
    FROM inventory
    WHERE product_id = ${productId}
      AND warehouse_id = ${warehouseId}
      AND location_id = ${locationId}
    FOR UPDATE
  `

  return rows[0] ?? null
}

export async function getInventoryRecordById(
  tx: PrismaTransactionClient,
  inventoryId: string,
): Promise<InventoryItemDto> {
  const record = await tx.inventory.findUnique({
    where: { id: inventoryId },
    include: inventoryInclude,
  })

  if (!record) {
    throw new Error('Inventory record not found after update')
  }

  return toInventoryItemDto(record)
}

export async function resolveDeviceRecordId(
  tx: PrismaTransactionClient,
  deviceId: string | undefined,
  userId: string,
): Promise<string | null> {
  if (!deviceId) return null

  const device = await tx.device.upsert({
    where: { deviceId },
    update: { lastSeenAt: new Date(), userId },
    create: { deviceId, userId, lastSeenAt: new Date() },
  })

  return device.id
}
