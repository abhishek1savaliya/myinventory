import { z } from 'zod'
import { ProductStatus } from '../types/index.js'

export const createProductSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(64),
  barcode: z.string().trim().min(1, 'Barcode is required').max(128),
  name: z.string().trim().min(1, 'Product name is required').max(255),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(128).optional(),
  imageUrl: z.string().url().max(2048).optional(),
  minimumStockLevel: z.coerce.number().int().min(0).default(0),
})

export const createProductFromScanSchema = createProductSchema
  .extend({
    imageBase64: z
      .string()
      .max(3_000_000, 'Image is too large')
      .optional(),
  })
  .omit({ imageUrl: true })

export const updateProductSchema = createProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
)

export const disableProductSchema = z.object({
  status: z.literal(ProductStatus.DISABLED),
})

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type CreateProductFromScanInput = z.infer<typeof createProductFromScanSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ProductListQuery = z.infer<typeof productListQuerySchema>
