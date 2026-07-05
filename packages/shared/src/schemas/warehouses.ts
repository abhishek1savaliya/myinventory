import { z } from 'zod'
import { WarehouseStatus } from '../types/index.js'

export const createWarehouseSchema = z.object({
  code: z.string().trim().min(1, 'Warehouse code is required').max(32),
  name: z.string().trim().min(1, 'Warehouse name is required').max(255),
  address: z.string().trim().max(500).optional(),
})

export const updateWarehouseSchema = createWarehouseSchema.partial().extend({
  status: z.nativeEnum(WarehouseStatus).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
)

export const warehouseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.nativeEnum(WarehouseStatus).optional(),
})

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>
export type WarehouseListQuery = z.infer<typeof warehouseListQuerySchema>
