import type { Product, ProductImage } from '@prisma/client'
import type {
  CreateProductInput,
  CreateProductFromScanInput,
  ProductDto,
  ProductImageDto,
  ProductListQuery,
  UpdateProductInput,
  UpdateProductFromScanInput,
} from '@myinventory/shared'
import { MAX_PRODUCT_IMAGES, ProductStatus } from '@myinventory/shared'
import { prisma } from '@myinventory/prisma'
import { AppError } from '../../middleware/error-handler.js'
import { cacheGetOrSet, cacheTtl, invalidateCache, stableCacheSuffix } from '../../lib/cache.js'
import { uploadProductImageFromBase64 } from '../../lib/product-images.js'

type ProductWithImages = Product & { images: ProductImage[] }

function toProductImageDto(image: ProductImage): ProductImageDto {
  return {
    id: image.id,
    url: image.url,
    sortOrder: image.sortOrder,
  }
}

function toProductDto(product: Product, images: ProductImage[] = []): ProductDto {
  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder)

  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    description: product.description,
    category: product.category,
    imageUrl: product.imageUrl ?? sortedImages[0]?.url ?? null,
    images: sortedImages.map(toProductImageDto),
    status: product.status as ProductStatus,
    minimumStockLevel: product.minimumStockLevel,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

async function fetchProductWithImages(id: string): Promise<ProductWithImages> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!product) {
    throw new AppError(404, 'Product not found')
  }

  return product
}

async function syncPrimaryImageUrl(productId: string): Promise<void> {
  const firstImage = await prisma.productImage.findFirst({
    where: { productId },
    orderBy: { sortOrder: 'asc' },
  })

  await prisma.product.update({
    where: { id: productId },
    data: { imageUrl: firstImage?.url ?? null },
  })
}

async function assertImageCapacity(productId: string, addingCount: number): Promise<number> {
  const currentCount = await prisma.productImage.count({ where: { productId } })

  if (currentCount + addingCount > MAX_PRODUCT_IMAGES) {
    throw new AppError(
      400,
      `Maximum ${MAX_PRODUCT_IMAGES} images per product (${currentCount} already saved)`,
    )
  }

  return currentCount
}

async function addImagesToProduct(productId: string, base64List: string[]): Promise<void> {
  if (base64List.length === 0) return

  const existingCount = await assertImageCapacity(productId, base64List.length)
  const uploads: Array<{ url: string; sortOrder: number }> = []
  let lastError: Error | null = null

  for (let index = 0; index < base64List.length; index += 1) {
    try {
      const url = await uploadProductImageFromBase64(base64List[index])
      uploads.push({ url, sortOrder: existingCount + index })
    } catch (error) {
      console.error('[addImagesToProduct] Image upload failed, skipping image')
      if (error instanceof Error) {
        console.error(error.message)
        lastError = error
      }
    }
  }

  if (uploads.length === 0) {
    throw new AppError(
      500,
      lastError instanceof AppError
        ? lastError.message
        : 'Failed to upload product images. Check Supabase product-images bucket configuration.',
    )
  }

  await prisma.productImage.createMany({
    data: uploads.map((upload) => ({
      productId,
      url: upload.url,
      sortOrder: upload.sortOrder,
    })),
  })

  await syncPrimaryImageUrl(productId)
}

async function removeImagesFromProduct(productId: string, imageIds: string[]): Promise<void> {
  if (imageIds.length === 0) return

  await prisma.productImage.deleteMany({
    where: {
      productId,
      id: { in: imageIds },
    },
  })

  await syncPrimaryImageUrl(productId)
}

function collectImagesBase64(input: {
  imageBase64?: string
  imagesBase64?: string[]
}): string[] {
  const images = [...(input.imagesBase64 ?? [])]

  if (input.imageBase64 && images.length === 0) {
    images.push(input.imageBase64)
  }

  return images.slice(0, MAX_PRODUCT_IMAGES)
}

function buildProductWhere(query: ProductListQuery) {
  const where: {
    OR?: Array<{
      sku?: { contains: string; mode: 'insensitive' }
      barcode?: { contains: string; mode: 'insensitive' }
      name?: { contains: string; mode: 'insensitive' }
    }>
    sku?: { contains: string; mode: 'insensitive' }
    barcode?: { contains: string; mode: 'insensitive' }
    status?: ProductStatus
  } = {}

  if (query.search) {
    where.OR = [
      { sku: { contains: query.search, mode: 'insensitive' } },
      { barcode: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  if (query.sku) {
    where.sku = { contains: query.sku, mode: 'insensitive' }
  }

  if (query.barcode) {
    where.barcode = { contains: query.barcode, mode: 'insensitive' }
  }

  if (query.status) {
    where.status = query.status
  }

  return where
}

export async function listProducts(query: ProductListQuery) {
  return cacheGetOrSet(
    'products',
    stableCacheSuffix('list', query),
    cacheTtl.catalog,
    async () => {
      const where = buildProductWhere(query)
      const skip = (query.page - 1) * query.pageSize

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: query.pageSize,
        }),
        prisma.product.count({ where }),
      ])

      return {
        data: products.map((product) => toProductDto(product)),
        total,
        page: query.page,
        pageSize: query.pageSize,
      }
    },
  )
}

export async function getProductById(id: string): Promise<ProductDto> {
  return cacheGetOrSet('products', stableCacheSuffix('id', { id }), cacheTtl.catalog, async () => {
    const product = await fetchProductWithImages(id)
    return toProductDto(product, product.images)
  })
}

export async function getProductByBarcode(barcode: string): Promise<ProductDto> {
  const normalizedBarcode = barcode.trim()

  return cacheGetOrSet(
    'products',
    stableCacheSuffix('barcode', { barcode: normalizedBarcode }),
    cacheTtl.catalog,
    async () => {
      const product = await prisma.product.findUnique({
        where: { barcode: normalizedBarcode },
        include: { images: { orderBy: { sortOrder: 'asc' } } },
      })

      if (!product) {
        throw new AppError(404, 'Product not found')
      }

      return toProductDto(product, product.images)
    },
  )
}

export async function createProduct(input: CreateProductInput): Promise<ProductDto> {
  try {
    const imageUrl = input.imageUrl?.trim() || null

    const product = await prisma.product.create({
      data: {
        sku: input.sku.trim(),
        barcode: input.barcode.trim(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        category: input.category?.trim() || null,
        imageUrl,
        minimumStockLevel: input.minimumStockLevel,
      },
    })

    if (imageUrl) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: imageUrl,
          sortOrder: 0,
        },
      })
    }

    await invalidateCache('products')
    await invalidateCache('inventory')

    return getProductById(product.id)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'SKU or barcode already exists')
    }
    throw error
  }
}

export async function createProductFromScan(input: CreateProductFromScanInput): Promise<ProductDto> {
  const { imageBase64, imagesBase64, ...productInput } = input
  const imagesToUpload = collectImagesBase64({ imageBase64, imagesBase64 })

  const product = await createProduct(productInput)

  if (imagesToUpload.length > 0) {
    await addImagesToProduct(product.id, imagesToUpload)
    await invalidateCache('products')
  }

  return getProductById(product.id)
}

export async function updateProductFromScan(
  id: string,
  input: UpdateProductFromScanInput,
): Promise<ProductDto> {
  const { imageBase64, imagesBase64, removeImageIds, ...productInput } = input
  const imagesToUpload = collectImagesBase64({ imageBase64, imagesBase64 })

  if (removeImageIds?.length) {
    await removeImagesFromProduct(id, removeImageIds)
  }

  if (imagesToUpload.length > 0) {
    await addImagesToProduct(id, imagesToUpload)
  }

  const updated = await updateProduct(id, productInput)

  if (removeImageIds?.length || imagesToUpload.length > 0) {
    await invalidateCache('products')
    return getProductById(id)
  }

  return updated
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  await getProductById(id)

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        sku: input.sku?.trim(),
        barcode: input.barcode?.trim(),
        name: input.name?.trim(),
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        category: input.category === undefined ? undefined : input.category?.trim() || null,
        imageUrl: input.imageUrl === undefined ? undefined : input.imageUrl?.trim() || null,
        minimumStockLevel: input.minimumStockLevel,
      },
    })

    if (input.imageUrl !== undefined) {
      const imageUrl = input.imageUrl?.trim() || null

      await prisma.productImage.deleteMany({ where: { productId: id } })

      if (imageUrl) {
        await prisma.productImage.create({
          data: {
            productId: id,
            url: imageUrl,
            sortOrder: 0,
          },
        })
      }
    }

    await invalidateCache('products')
    await invalidateCache('inventory')

    return getProductById(product.id)
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, 'SKU or barcode already exists')
    }
    throw error
  }
}

export async function disableProduct(id: string): Promise<ProductDto> {
  await getProductById(id)

  const product = await prisma.product.update({
    where: { id },
    data: { status: ProductStatus.DISABLED },
  })

  await invalidateCache('products')
  await invalidateCache('inventory')

  return toProductDto(product, [])
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}
