import { z } from 'zod'
import { ProductStatus } from '../types/index.js'

export const MAX_PRODUCT_IMAGES = 10

const imageBase64Schema = z.string().max(3_000_000, 'Image is too large')

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
    imageBase64: imageBase64Schema.optional(),
    imagesBase64: z.array(imageBase64Schema).max(MAX_PRODUCT_IMAGES).optional(),
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

export const updateProductFromScanSchema = createProductSchema
  .partial()
  .extend({
    imageBase64: imageBase64Schema.optional(),
    imagesBase64: z.array(imageBase64Schema).max(MAX_PRODUCT_IMAGES).optional(),
    removeImageIds: z.array(z.string().trim().min(1)).optional(),
  })
  .omit({ imageUrl: true })
  .refine(
    (data) => {
      const hasFieldUpdate = Object.entries(data).some(
        ([key, value]) =>
          !['imageBase64', 'imagesBase64', 'removeImageIds'].includes(key) && value !== undefined,
      )
      const hasImageUpdate =
        Boolean(data.imageBase64) ||
        (data.imagesBase64?.length ?? 0) > 0 ||
        (data.removeImageIds?.length ?? 0) > 0
      return hasFieldUpdate || hasImageUpdate
    },
    { message: 'At least one field is required' },
  )

export type UpdateProductFromScanInput = z.infer<typeof updateProductFromScanSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ProductListQuery = z.infer<typeof productListQuerySchema>
