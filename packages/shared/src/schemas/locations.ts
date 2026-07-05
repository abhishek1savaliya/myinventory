import { z } from 'zod'
import { LocationStatus } from '../types/index.js'

export const createLocationSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  code: z.string().trim().min(1, 'Location code is required').max(64),
  zone: z.string().trim().max(32).optional(),
  aisle: z.string().trim().max(32).optional(),
  rack: z.string().trim().max(32).optional(),
  shelf: z.string().trim().max(32).optional(),
  bin: z.string().trim().max(32).optional(),
})

export const updateLocationSchema = createLocationSchema
  .omit({ warehouseId: true })
  .partial()
  .extend({
    status: z.nativeEnum(LocationStatus).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field is required' },
  )

export const locationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  warehouseId: z.string().trim().optional(),
  status: z.nativeEnum(LocationStatus).optional(),
})

export type CreateLocationInput = z.infer<typeof createLocationSchema>
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>
export type LocationListQuery = z.infer<typeof locationListQuerySchema>
