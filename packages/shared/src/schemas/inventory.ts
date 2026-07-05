import { z } from 'zod'
import { AdjustmentReason, TransactionType } from '../types/index.js'

const baseOperationSchema = z.object({
  reference: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(2000).optional(),
  deviceId: z.string().trim().max(128).optional(),
})

export const receiveStockSchema = baseOperationSchema.extend({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.coerce.number().int().positive('Quantity must be greater than zero'),
})

export const moveStockSchema = baseOperationSchema.extend({
  productId: z.string().min(1),
  sourceWarehouseId: z.string().min(1),
  sourceLocationId: z.string().min(1),
  destinationWarehouseId: z.string().min(1),
  destinationLocationId: z.string().min(1),
  quantity: z.coerce.number().int().positive('Quantity must be greater than zero'),
})

export const pickStockSchema = baseOperationSchema.extend({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.coerce.number().int().positive('Quantity must be greater than zero'),
})

export const returnStockSchema = baseOperationSchema.extend({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  locationId: z.string().min(1),
  quantity: z.coerce.number().int().positive('Quantity must be greater than zero'),
})

export const adjustStockSchema = baseOperationSchema.extend({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  locationId: z.string().min(1),
  quantityDelta: z.coerce.number().int().refine((v) => v !== 0, {
    message: 'Adjustment quantity cannot be zero',
  }),
  adjustmentReason: z.nativeEnum(AdjustmentReason),
  notes: z.string().trim().min(1, 'Notes are required for adjustments'),
  allowNegative: z.boolean().optional().default(false),
})

export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  locationId: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  search: z.string().trim().optional(),
})

export const transactionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  transactionId: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  productId: z.string().trim().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  warehouseId: z.string().trim().optional(),
  locationId: z.string().trim().optional(),
  userId: z.string().trim().optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
})

export type ReceiveStockInput = z.infer<typeof receiveStockSchema>
export type MoveStockInput = z.infer<typeof moveStockSchema>
export type PickStockInput = z.infer<typeof pickStockSchema>
export type ReturnStockInput = z.infer<typeof returnStockSchema>
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>
