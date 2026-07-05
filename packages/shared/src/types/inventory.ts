import type { AdjustmentReason, TransactionType } from './index.js'

export interface InventoryItemDto {
  id: string
  productId: string
  sku: string
  barcode: string
  productName: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  locationId: string
  locationCode: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  updatedAt: string
}

export interface InventoryTransactionDto {
  id: string
  type: TransactionType
  productId: string
  sku: string
  productName: string
  quantity: number
  sourceWarehouseCode: string | null
  sourceLocationCode: string | null
  destinationWarehouseCode: string | null
  destinationLocationCode: string | null
  userId: string
  userName: string
  reference: string | null
  notes: string | null
  adjustmentReason: AdjustmentReason | null
  createdAt: string
}

export interface StockOperationResult {
  transactionId: string
  inventory: InventoryItemDto
}

export interface MoveStockResult {
  transactionId: string
  sourceInventory: InventoryItemDto
  destinationInventory: InventoryItemDto
}
